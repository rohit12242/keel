# ADR-006 — What runs the app on AWS

**Decision:** S1-E · **Story:** W3-17 · **Status:** Decided · **Date:** 2026-09-17

> **Revision 4 — TLS through CloudFront, no domain.** R3's domain was never
> registered, so the deployment stayed HTTP-only. CloudFront's default
> certificate now works on this account, and it gives HTTPS **between the viewer
> and AWS**. It does not give it between CloudFront and the ALB: that leg is
> plain HTTP, which **does not meet NFR-11**. See *TLS through CloudFront*.
>
> **Revision 3 — TLS.** R2 specified TLS at the ALB but never said where the
> certificate comes from, and on this account there was no working path. Resolved
> by registering a domain; see *TLS and the certificate*. Found by trying to
> implement the ADR, which is the only way that class of gap gets found.
>
> **Revision 2 — superseded by fact, not by argument.** R1 chose App Runner.
> **App Runner is not available on the AWS Free Plan**, which this account is on.
> AWS's supported-services list for the new sign-up experience puts it under
> *unsupported*; the error is `SubscriptionRequiredException` and no retry or
> permission change fixes it. **The decision is now ECS Fargate behind an ALB** —
> R1's runner-up, which lost only on cost, an argument that no longer applies
> because the cheaper option does not exist for this account. R1's reasoning is
> kept below so the trade is visible.

## Context

D-06 chose AWS, explicitly for operational learning and employability rather than
for any technical property AWS uniquely has. ADR-004 settled one deployed
environment: production. Nothing has said *what runs the application there*.

Three facts shape this:

- A new AWS account with **$100 of credits**.
- **Employability** — these choices appear on a CV and get probed in interviews.
- **Claude Code has AWS access** and can create infrastructure, which removes
  most of the setup-effort argument between options.

Keel is server-rendered (D-04), so it needs a running Node process. Static hosting
cannot serve it.

## Decision

**ECS Fargate behind an Application Load Balancer, RDS Postgres for data,
provisioned with Terraform, deployed by GitHub Actions through an OIDC role.**

| Concern | Choice |
|---|---|
| Compute | ECS Fargate task, image from ECR |
| Ingress and TLS | CloudFront on its default certificate, in front of an Application Load Balancer that admits only CloudFront (R4) |
| Database | RDS Postgres, `db.t4g.micro` |
| Configuration and secrets | SSM Parameter Store |
| Infrastructure as code | **Terraform** |
| Deploy identity | GitHub OIDC role — **no long-lived access keys** |

## Why not App Runner — the constraint that decided it

App Runner is **unavailable on this account**. AWS's Free Plan supports 100+
services; App Runner is explicitly on the unsupported list for the new sign-up
experience. The failure is `SubscriptionRequiredException`, an entitlement error
rather than a permissions or Terraform problem.

**Upgrading the account to reach it was considered and rejected.** The Free Plan's
protection is that spending cannot exceed the credits — the account is limited
rather than billed. Activating advanced features trades that guardrail for a
service that was only ever the second-best technical fit. For a developer with no
income, the guardrail is worth more than the compute choice.

## What R1 argued, and why it no longer decides

R1 preferred App Runner on cost:

| Stack | Monthly | $100 of credits lasts |
|---|---|---|
| App Runner + RDS | ~$20 | ~5 months |
| **ECS Fargate + ALB + RDS** | **~$40** | **~2.5 months** |

That reasoning was sound and is now moot: the cheaper option is not purchasable
here at any price. What remains is that **2.5 months covers the seven weeks left
in the delivery plan**, so the constraint binds after the project rather than
during it.

R1 also worried that ECS would not fit W3-17's two-hour box. That box measured
attention rather than machine time, and the work is delegated — so it is no longer
the binding constraint either.

**The CV argument now runs the other way.** ECS Fargate is the more recognised
line, and D-06 chose AWS explicitly for employability. R1 had to argue that the
Terraform and OIDC clauses carried the résumé weight on their own. They still do —
but this decision no longer needs them to.

## TLS and the certificate — added in revision 3

R2 said "TLS at the ALB" without saying where the certificate comes from. In
practice there was no path: **ACM issues certificates only for domains you
control**, an ALB's own DNS name is not one, and the usual no-domain workaround —
CloudFront's default certificate — is blocked on this account pending
verification.

**Decision: register a domain.**

- ACM certificates are then free and renew automatically.
- Cognito callback URLs in E-06 need a stable hostname; an ALB DNS name is a poor
  one.
- E-07's demo and release are materially better on a real domain.
- It removes the dependency on CloudFront and on account verification.

Roughly $12–15 a year against ~$40 a month of compute. It is also the only part of
this that outlives the infrastructure.

**Do not use `.app` or `.dev`.** Both are HSTS-preloaded, so browsers refuse plain
HTTP entirely — which forecloses the interim below.

**Complete AWS account verification anyway.** It is free, it unblocks CloudFront,
and an unverified account will produce another of these.

### The interim, and where it ends

**HTTP-only is acceptable while there is no user data and no authentication** —
that is, for a deployment serving a health endpoint and a seeded read. It is not a
permanent state and it is not a preference.

**HTTPS is a precondition for E-06.** NFR-11 requires TLS in transit and the log
holds diary-grade text. The moment a real credential or a real entry can cross the
wire, HTTP is a defect, not a shortcut.

Recorded this way so that "we were going to fix that" has a date attached rather
than a good intention.

## TLS through CloudFront — added in revision 4

R3 chose a registered domain. It was never registered, so the service stayed on
plain HTTP at the ALB's own name. CloudFront, which R3 recorded as blocked
pending account verification, was tried again and accepted.

**Decision: CloudFront in front of the ALB, on CloudFront's default
`*.cloudfront.net` certificate.**

- The public URL is `https://<id>.cloudfront.net`. Plain HTTP there redirects to
  HTTPS.
- Nothing is cached. Every method passes through, and so do all cookies, query
  strings and viewer headers, Authorization included. Host is forwarded, so the
  app sees the public hostname. `CloudFront-Forwarded-Proto` says the viewer
  used HTTPS; the ALB's `X-Forwarded-Proto` will say `http`, because that is the
  leg the ALB saw. Anything that decides on the scheme, such as a `Secure`
  cookie, must read CloudFront's header, not the ALB's.
- The ALB admits only the AWS-managed CloudFront origin-facing prefix list. Its
  listener forwards only requests carrying a secret header that CloudFront adds,
  and refuses the rest with 403. The prefix list admits *any* CloudFront
  distribution; the header is what makes it ours. The secret lives in Terraform
  state, which is encrypted in S3.
- The target group's `/health` check is the ALB calling the task directly, so
  it is unaffected. The deploy smoke check and the runbook use the CloudFront
  URL, because the ALB refuses a direct call.

### What this does not give — stated plainly

**The CloudFront → ALB leg is plain HTTP.** The ALB has no certificate,
because ACM issues certificates only for names we control, and an ALB's DNS name
is not one. The ALB is internet-facing, so that leg runs to a public address. It
is not guaranteed to stay on AWS's private network. It carries the session
cookie, the Authorization header and any entry text in the clear.

**The viewer leg's floor is TLS 1.0.** On the default certificate, CloudFront
fixes the security policy at `TLSv1`, and it cannot be raised. Current browsers
negotiate TLS 1.2 or 1.3, but the server does not *refuse* older versions.

**Against NFR-11** ("TLS 1.2+ in transit"), both are misses:

| Leg | Encrypted | TLS 1.2+ enforced | NFR-11 |
|---|---|---|---|
| Viewer → CloudFront | Yes | No — floor is TLS 1.0 | Not met as written |
| CloudFront → ALB | **No** | — | **Not met** |
| ALB → task | No, inside the VPC | — | Unchanged from R2 |
| Task → RDS | Yes (`sslmode=no-verify`) | — | Unchanged |

This closes the leg that crosses networks nobody here controls, such as café
Wi-Fi and the ISP. That is where interception is cheapest. It does not close the
one NFR-11 names.

### Where it ends

**Both gaps close the same way: a name we control.** With a domain, ACM issues a
certificate for the ALB, so the origin leg becomes `https-only`. CloudFront can
then serve the same domain on a custom certificate under `TLSv1.2_2021`. R3's
reasoning for a domain still stands. R4 only removes the wait for one.

**R3's gate on E-06 is restated, not relaxed.** E-06 may build and test
authentication behind this arrangement. **No real user's credential or entry
goes in until the origin leg is encrypted.** Until then, the deviation from
NFR-11 is recorded here with its end condition, rather than discovered later.

## Controlling the cost, since the ALB does not pause

An ALB bills whether or not traffic reaches it. Two levers, in order:

1. **Set the ECS desired count to zero** when not in use. Stops the Fargate
   charge; the ALB continues at roughly $17 a month.
2. **`terraform destroy` the whole environment** between working sessions and
   recreate it from code in minutes.

The second is the real answer, and it is worth doing at least once deliberately:
**an environment you can destroy and recreate is the only proof that the
infrastructure is genuinely code.** If recreating it requires a console click, the
Terraform was incomplete and this is how you find out.

## The CV line

Unchanged by the switch, and still the part that carries the weight:

> Provisioned AWS infrastructure as code with Terraform; containerised deploys to
> ECR through GitHub Actions using OIDC federation, with no long-lived
> credentials; managed Postgres on RDS with automated backups and a rehearsed
> restore.

Every clause is true here, and with ECS the task definitions, services and target
groups are now real experience rather than something argued around. Infrastructure
as code and credential-free CI remain the parts interviewers probe.

**Terraform rather than CDK** for the same reason: it appears in more job posts and
is portable across clouds. CDK in TypeScript would be defensible and more coherent
with D-02, but it is the less transferable line.

## The cheaper fallback, if credits become the binding problem

A single EC2 instance running Docker with Caddy for TLS is roughly $10 a month all
in — cheaper, entirely defensible at one user, and a weaker interview story. It is
the option to take if the seven remaining weeks start to look expensive, and it
stays available because EC2 is supported on the Free Plan.

## Rules that come with this decision

**Everything is Terraform. Nothing is created in the console.**
A resource created by clicking is invisible to the code, survives
`terraform destroy`, and bills forever. With an agent provisioning
infrastructure this stops being a style preference and becomes the only way the
account stays comprehensible.

**A budget alarm exists before any resource does.**
AWS Budgets, alerts at $20 and $50. An agent with infrastructure permissions can
create a NAT gateway at ~$32 a month in a single command, and the first sign would
otherwise be the bill.

**The deploy role is scoped to the services in use**, not `AdministratorAccess`.

**No NAT gateway.** It costs more than everything else here combined. Put the
Fargate task in a public subnet with a public IP, or use VPC endpoints for ECR and
Secrets Manager. If something appears to need a NAT gateway, that is a signal the
design went wrong, not a cost to accept.

## Sequencing inside the two-hour box

1. Budget alarm and scoped role.
2. VPC, ECS cluster, task definition, service, ALB. App reachable with a green
   health endpoint, **no database**. HTTP is acceptable at this step only; add the
   HTTPS listener as soon as the domain and ACM certificate exist. Stop and report.
3. RDS in a private subnet, security group allowing only the task, secrets in
   Parameter Store, the migration step. Stop and report.
4. Deploy from GitHub Actions on a release — a pushed `v*` tag, or a manual
   redeploy of an existing image (amended W4-07; ADR-004 R4). Merge to main
   no longer deploys.

**Do not make RDS publicly accessible** as a shortcut at any point. With ECS the
task and the database sit in the same VPC, so there is no reason to.

## Consequences

**Good**

- Available on this account, which App Runner is not.
- The Free Plan's no-surprise-bill protection is kept.
- The stronger CV line, and the one D-06 was actually buying.
- Full control of networking, which makes the private-RDS arrangement simple.
- Credits cover the remaining seven weeks of the plan.

**Costs accepted**

- Roughly double the monthly cost, and the ALB bills whether used or not. Managed
  by scaling to zero, and by destroying the environment between sessions.
- More resources to define and more that can be misconfigured. Mitigated by all of
  it being Terraform and by the delegated build.
- Credits run out sooner. That lands after the delivery plan ends, which is the
  right side of the deadline.

## Revisit when

- Credits run out — at roughly $40 a month that is about ten weeks away.
  Re-examine against income at that point; the EC2 fallback above is the answer if
  there is none.
- The account leaves the Free Plan for any other reason, which puts App Runner
  back on the table as a cheaper option.
- **E-06 begins.** HTTPS must be in place before authentication or any real entry
  exists. If it is not, that is the story that blocks, not a note to carry.
- **The first real user's data is about to go in** (R4). The CloudFront → ALB
  leg must be encrypted first, which means a domain and an ACM certificate on the
  ALB. Until then NFR-11 is knowingly unmet on that leg.
- Destroying and recreating the environment proves harder than described. That
  means the Terraform is incomplete, and it is the one failure that undermines
  every cost control here.
