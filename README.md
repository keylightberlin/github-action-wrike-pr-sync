# Github Action Wrike PR Sync

Wrike is a project management tool. It's quite fast and flexible, but lacking an integration with Github PRs.
This action will search for a Wrike ticket connected to your PRs and will update the status to your `In Review` state as soon as you create the PR.
As soon as your PR is merged your ticket will be updated to the next applicable state. Additionally, it's adding a PR link to the wrike ticket.

see here for more information on the Wrike API: https://developers.wrike.com/


## Inputs

### `WRIKE_ACCESS_TOKEN`

**Required** Your permanent wrike API token.


### `WRIKE_IN_REVIEW_STATE`

**Required** The name of your `In Review` state


### `WRIKE_MERGED_STATE`

**Required** The name of your `After merge` state. E.g. `Ready for QA`


## Example usage
Usage
This Action subscribes to Pull request events which fire whenever pull requests are created.

```
name: Update wrike tasks based on Github PRs.
on:
  pull_request:
    types: [opened, closed]
jobs:
  issue-backlink-to-wrike:
    runs-on: ubuntu-latest
    steps:
    - name: Issue backlink to wrike
      uses: keylightberlin/github-action-wrike-pr-sync@v1.0.0
      env:
        WRIKE_ACCESS_TOKEN: ${{ secrets.WRIKE_ACCESS_TOKEN }}
        WRIKE_IN_REVIEW_STATE: 'In Review'
        WRIKE_MERGED_STATE: 'Ready for QA'
```
