# Keel Runbook — Release, Deploy & Roll Back

**Merging to `main` does not deploy. Releasing does.** A release is a `v*` tag
you push on a commit that is already on `main`, and that tag deploys it. Rolling
back is running the deploy again against the previous release's tag — no
rebuild, no migration. Both are deliberate: an agent can merge a PR, but only you
put something in production (ADR-004, W4-07).

Most important thing to remember when tired: **a release whose new tasks fail
their health checks does not replace the running site** — ECS's circuit breaker
returns the service to its last healthy deployment. What is *not* automatic: a
release that starts healthy but is wrong stays live until you roll it back, and a
red smoke check only turns the run red. So if a deploy goes red, check
`/health` first; then read *Roll back*. Copy commands exactly as written.

## At a glance

| Thing | Value |
| --- | --- |
| Region | `us-east-1` |
| Account | `925513250944` |
| ECS cluster | `keel` |
| ECS service | `keel` |
| Migration task | `keel-migrate` |
| ECR repo | `925513250944.dkr.ecr.us-east-1.amazonaws.com/keel` |
| Deploy role | `arn:aws:iam::925513250944:role/keel-deploy-role` |
| Health check | `http://keel-438695349.us-east-1.elb.amazonaws.com/health` |

The service always runs the image tagged `:latest`. A release builds
`keel:<sha>` (the commit's first 12 characters), pushes it as `:latest` too, and
forces a fresh pull. A rollback moves `:latest` back onto an earlier
`keel:<sha>`.

## What is merged but not released yet

Merges collect on `main` until you release them. To see what the next release
would ship:

```
git fetch origin --tags
LAST=$(git describe --tags --abbrev=0 --match 'v*' origin/main)
git log --oneline "$LAST"..origin/main
```

Empty output means production already runs everything on `main`. If there is no
release tag yet, `git describe` fails — the first release ships all of `main`.

## Release — the normal way (tag a commit on main)

1. Pick the commit — normally the tip of `main`. PRs are squash-merged, so
   release the squash commit **on `main`**, never a commit from a PR branch: the
   deploy refuses any commit that is not on `main`.
    ```
    git fetch origin
    git log --oneline -5 origin/main
    ```
2. Tag it and push the tag (bump the patch for a fix, the minor for new
   behaviour):
    ```
    git tag vX.Y.Z <sha>
    git push origin vX.Y.Z
    ```
3. The tag push starts the deploy. GitHub Actions does the rest: OIDC login →
   build `keel:<sha>` → run pending migrations → roll the service → smoke-check
   `/health`. Watch it:
    ```
    gh run list --workflow=deploy.yml --limit 1
    gh run watch --exit-status
    ```
4. Green = done; the smoke check already confirmed `/health` is `app:ok,
   database:ok`.
5. If it goes red, **the site is still up on the old version.** Go to *Check it
   worked* to see which step failed, then decide between re-running and rolling
   back. Do not push more tags in a panic.

A run that fails with "is not on main" means the tag is on the wrong commit.
Remove it (`git push origin :refs/tags/vX.Y.Z && git tag -d vX.Y.Z`) and tag the
squash commit on `main`.

## Deploy — when GitHub Actions is down

**Try the easy fallback first.** Re-run the last deploy job — it fixes most
transient failures:

```
gh run list --workflow=deploy.yml --limit 1   # get the run id
gh run rerun <run-id> --failed
```

**Only if Actions itself is down**, deploy by hand from your machine. This needs
Docker/colima running (8 GB) and builds for `linux/amd64`. Check out the commit
you are releasing first — it must be on `main`.

1. Get deploy credentials (the `keel-deploy` user can't do this work directly —
   assume the role):
    ```
    CREDS=$(aws sts assume-role \
      --role-arn arn:aws:iam::925513250944:role/keel-deploy-role \
      --role-session-name manual-deploy --profile keel-deploy \
      --query Credentials --output json)
    export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r .AccessKeyId)
    export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r .SecretAccessKey)
    export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r .SessionToken)
    ```
2. Log in to ECR:
    ```
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 925513250944.dkr.ecr.us-east-1.amazonaws.com
    ```
3. Build and push both images (amd64). Tag the app image with its SHA as well as
   `:latest`, so this release can be rolled back to later:
    ```
    ECR=925513250944.dkr.ecr.us-east-1.amazonaws.com/keel
    SHA=$(git rev-parse --short=12 HEAD)
    docker buildx build --platform linux/amd64 -f Dockerfile -t "${ECR}:${SHA}" -t "${ECR}:latest" --push .
    docker buildx build --platform linux/amd64 -f Dockerfile.migrate -t "${ECR}:migrate" --push .
    ```
4. Run the migration as a one-off task and wait for it:
    ```
    SUBNETS=$(aws ec2 describe-subnets --filters Name=tag:Name,Values=keel-public-1,keel-public-2 --query 'Subnets[].SubnetId' --output text | tr '\t' ',')
    SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=keel-task --query 'SecurityGroups[0].GroupId' --output text)
    TASK=$(aws ecs run-task --cluster keel --task-definition keel-migrate --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
      --query 'tasks[0].taskArn' --output text)
    aws ecs wait tasks-stopped --cluster keel --tasks "$TASK"
    aws ecs describe-tasks --cluster keel --tasks "$TASK" --query 'tasks[0].containers[0].exitCode' --output text   # must be 0
    ```
5. Roll the service to the new image and wait until stable:
    ```
    aws ecs update-service --cluster keel --service keel --force-new-deployment
    aws ecs wait services-stable --cluster keel --services keel
    ```
6. Confirm with the health check in the last section, then push the release tag
   for that commit so the record matches what is live.

## Roll back — the normal way (redeploy the previous release)

Rolling back is redeploying the previous release's image — the artifact that was
live before. No rebuild, no migration.

1. Find the previous release tag:
    ```
    git fetch origin --tags
    git tag --list 'v*' --sort=-v:refname | head -3
    ```
2. Redeploy it:
    ```
    gh workflow run deploy.yml -f ref=vX.Y.Z
    gh run list --workflow=deploy.yml --limit 1
    gh run watch --exit-status
    ```
    Or in GitHub: **Actions → Deploy → Run workflow**, and enter the tag. The run
    checks the tag is on `main`, confirms `keel:<sha>` still exists in ECR,
    points `:latest` at it, rolls the service and smoke-checks.
3. **Then fix `main`.** A rollback changes what is live, not what is on `main`.
   Revert the bad change through a PR (`git revert <sha>`, or
   `git revert -m 1 <merge-sha>` for a merge commit) so the next release does not
   ship it again. The revert deploys nothing by itself — it goes live with the
   next tag.

**Why no migration on rollback.** The older code runs against the newer schema.
That is safe only because migrations are expand-migrate-contract (ADR-004): a
release never removes or narrows anything the previous release still reads. That
rule is what makes this rollback safe. If a migration ever did break the previous
release, the schema has to be rolled back separately and deliberately
(`npm run migrate:down`, one step, against production).

**How far back you can go: one release.** ECR keeps only the last 5 images
(`infra/ecr.tf`) and every release pushes two (app, then migrate), so after a
release only the **previous** release's app image is guaranteed to still exist.
An older tag's image has expired, and the run refuses it with "No image
keel:<sha> in ECR". In that case, revert on `main` and cut a new release instead.

**If a release's migration failed.** The run stops, but it had already moved
`:latest` to the new image. Roll back to the previous tag straight away so
`:latest` points at code that matches the schema.

The `ref` must be a **tag or a full 40-character SHA** — a short SHA fails at
checkout. Redeploying the release that is already live is allowed and harmless.

## Roll back — when GitHub Actions is down

The same thing the rollback run does, by hand: re-point `:latest` at a known-good
earlier image and force a redeploy. Get deploy credentials first (step 1 of the
manual deploy above), then:

1. Pick the last good image tag — every release tags the image with its
   12-char commit SHA. List recent ones, newest first:
    ```
    aws ecr describe-images --repository-name keel \
      --query 'reverse(sort_by(imageDetails,&imagePushedAt))[].imageTags' --output text | head
    ```
2. Move `:latest` onto that good SHA (no rebuild — just re-tags the existing
   image):
    ```
    GOOD=<good-12-char-sha>
    MANIFEST=$(aws ecr batch-get-image --repository-name keel --image-ids imageTag=$GOOD --query 'images[0].imageManifest' --output text)
    aws ecr put-image --repository-name keel --image-tag latest --image-manifest "$MANIFEST"
    ```
3. Force a redeploy and wait:
    ```
    aws ecs update-service --cluster keel --service keel --force-new-deployment
    aws ecs wait services-stable --cluster keel --services keel
    ```
4. Confirm with the health check below. **Then fix `main`** (step 3 of the
   previous section) so the next release does not re-ship the bad version.

## Check it worked — and where to look if not

**Did it work?** One command — you want `app` and `database` both `ok`:

```
curl -s http://keel-438695349.us-east-1.elb.amazonaws.com/health
```

Expected: `{"status":"ok","app":"ok","database":"ok", ...}`. If `database` is
`unreachable`, the app is up but can't reach RDS — not a code problem; check RDS
and the SSM `DATABASE_URL`.

**Where to look when a deploy went red:**

1. Which step failed:
    ```
    gh run view <run-id> --log-failed
    ```
2. What the running container is saying (last 20 min of app logs):
    ```
    aws logs tail /ecs/keel --since 20m --follow
    ```
    Log lines carry ids and types only — no entry text — so it is safe to paste
    them when asking for help.
3. Whether the service is actually rolling or stuck: ECS console → cluster `keel`
   → service `keel` → **Deployments** and **Events**. A stuck deploy that never
   stabilises is what the circuit breaker rolls back on its own.

Still stuck after one honest pass? The site is on the old version and safe. Stop,
note what you saw, and pick it up rested — that is the whole point of this page.

## Teardown — NOT a rollback (rare, destructive)

**Stop.** This deletes the whole environment — service, database, load balancer,
everything. It is never how you fix a bad deploy. If you are here to recover from
a deploy, you are in the wrong section; go back to *Roll back*. Only run this to
intentionally shut Keel down.

Destroy in two stages, app layer first, bootstrap last:

1. App layer (service, RDS, ALB, networking) — drops running cost to about $0:
    ```
    cd infra && terraform destroy
    ```
2. Bootstrap (deploy role, OIDC, budget, state backend) — only if you are
   retiring the project entirely. Needs the **root** `keel` profile, and you must
   empty the S3 state bucket first:
    ```
    cd infra/bootstrap && terraform destroy
    ```

Losing the bootstrap layer removes the Terraform state backend and the deploy
role, so a later rebuild starts from scratch. If in any doubt, stop at stage 1.
