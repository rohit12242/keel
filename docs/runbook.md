# Keel Runbook — Deploy & Roll Back

**Two things, both safe. Deploying is merging to `main`. Rolling back is
reverting on `main`.** You almost never need the manual paths. Most important
thing to remember when tired: **a failed deploy cannot take the site down** —
ECS keeps the old version running and rolls back on its own. So if a deploy goes
red, the live site is still fine; breathe, then read *Roll back*. Copy commands
exactly as written.

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

The service always runs the image tagged `:latest`. A deploy just pushes a new
`:latest` and forces a fresh pull.

## Deploy — the normal way (merge to main)

Merging a PR into `main` is the deploy. GitHub Actions does the rest: OIDC login
→ build → run pending migrations → roll the service → smoke-check `/health`.

1. Merge the PR into `main` (the required `ci` check must be green first).
2. Watch it from the terminal:
    ```
    gh run watch --exit-status
    ```
    Or open the run in the browser:
    ```
    gh run list --workflow=deploy.yml --branch main --limit 1
    ```
3. Wait for it to finish. Green = done; the smoke check already confirmed
   `/health` is `app:ok, database:ok`.
4. If it goes red, **the site is still up on the old version.** Go to *Check it
   worked* to see which step failed, then decide between retrying and rolling
   back. Do not panic-push more commits.

## Deploy — when GitHub Actions is down

**Try the easy fallback first.** Re-run the last deploy job — it fixes most
transient failures:

```
gh run list --workflow=deploy.yml --branch main --limit 1   # get the run id
gh run rerun <run-id> --failed
```

**Only if Actions itself is down**, deploy by hand from your machine. This needs
Docker/colima running (8 GB) and builds for `linux/amd64`.

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
3. Build and push both images (amd64), tagged `:latest` and `:migrate`:
    ```
    ECR=925513250944.dkr.ecr.us-east-1.amazonaws.com/keel
    docker buildx build --platform linux/amd64 -f Dockerfile -t "${ECR}:latest" --push .
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
6. Confirm with the health check in the last section.

## Roll back — the normal way (revert on main)

Roll back the same way you deploy: put the previous good code back on `main` and
let the pipeline redeploy it. This is the right choice for a deploy that went out
healthy but is behaving wrong.

1. Find the bad commit:
    ```
    git log --oneline -5 main
    ```
2. Revert it (this makes a new commit that undoes it — nothing is erased, which
   fits Keel's append-only rule):
    ```
    git revert <bad-commit-sha>
    ```
    If a whole PR merge is bad, revert the merge commit: `git revert -m 1 <merge-sha>`.
3. Open a PR for the revert, let `ci` go green, and merge it.
4. The merge triggers a normal deploy of the previous code. Watch it with
   `gh run watch --exit-status` and confirm `/health`.

If a migration shipped with the bad change, reverting the code does **not** undo
the schema change. Roll the schema back separately with `npm run migrate:down`
(one step) before or after, depending on whether the old code can run against the
new schema.

## Roll back — the emergency way (site is wrong right now)

**You probably don't need this.** A deploy that fails its health check is
auto-rolled-back by the ECS circuit breaker — the old version keeps serving. Use
this only when a *healthy* deploy is live, actively wrong, and you cannot wait
~5 minutes for the revert pipeline.

It re-points `:latest` at a known-good earlier image and forces a redeploy. Get
deploy credentials first (step 1 of the manual deploy above), then:

1. Pick the last good image tag — every deploy also tags the image with its
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
4. Confirm with the health check below. **Then also do the git revert** (previous
   section) so `main` matches what is live — otherwise the next merge re-ships the
   bad version.

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
