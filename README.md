# Database CI/CD GitHub Actions Example

Please refer to [the new example](https://github.com/bytebase/bytebase-release-cicd-workflows-example).

---

Corresponding Tutorial: [Automating Database Schema Change workflow Using GitHub Actions](https://www.bytebase.com/docs/tutorials/github-ci/).

Sample github custom actions to call Bytebase API to coordinate the schema migration in Bytebase with the GitHub PR workflow. A typical workflow works like this:

1. Create PR containing both code change and schema migration for review.
1. PR approved.
1. Rollout the schema migration.
1. Merge the PR and kicks of the pipeline to release the application.

You can combine these custom github actions to achieve such workflow:

- [login](https://github.com/bytebase/github-action-example/tree/main/.github/actions/login)
  authenticates with Bytebase and obtain the token.
- [sql-review](https://github.com/bytebase/github-action-example/tree/main/.github/actions/sql-review)
  checks the configured SQL Review policy and reports inline violations if found.
  ![sql-review](https://raw.githubusercontent.com/bytebase/github-action-example/main/assets/step1-create-migration-script-pr.webp)
- [upsert-issue](https://github.com/bytebase/github-action-example/tree/main/.github/actions/upsert-issue) creates or updates the Bytebase migration issue for the PR. If you change the migration script during the PR process, this action will update the corresponding Bytebase migration task as well. And it will return error if you attempt to update a migration script when the corresponding migration task has already been rolled out.
- [check-issue-status](https://github.com/bytebase/github-action-example/tree/main/.github/actions/check-issue-status) reports the overall issue status, as well as the rollout status for each
  migration file. It will also report error if the Bytebase rollout content mismatches with the migration file. **You can use this action to block the PR until all migrations complete**.
- [approve-issue](https://github.com/bytebase/github-action-example/tree/main/.github/actions/approve-issue) approves the Bytebase migration issue. **You can use this action to propagate the PR approval to Bytebase**.

## Sample Workflow - Create Migration Issue on PR Approval

- `sql-review` on PR change. Thus any SQL review violation will block the PR.
- `check-issue-status` on PR change. Thus PR will be blocked until migration completes.
- `upsert-issue` on PR approval. Creates the migration after approval, and even migration
  script changes afterwards, the migration issue will also be updated accordingly.

## Sample Workflow - Create Migration Issue on PR Creation

- `sql-review` on PR change. Thus any SQL review violation will block the PR.
- `check-issue-status` on PR change. Thus PR will be blocked until migration completes.
- `upsert-issue` on PR creation. Whenever the migration script changes, the migration issue will also be updated accordingly.
- `approve-issue` on PR approval. Whenever the PR is approved, it will in turn approve
  the Bytebase rollout.
