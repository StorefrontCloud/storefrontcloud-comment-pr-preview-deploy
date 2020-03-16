const core = require('@actions/core');
const github = require('@actions/github');

const isPush = ({eventName, issue: { number }}) => {
  if (number && eventName !== 'push') {
    return false;
  }
  
  return true;
}

const upsertDeployComment = async (client, repo, deployUrl, namespace, issue, pullNumber) => {
  const { data: comments } = await client.repos.listCommentsForIssue({
    ...repo,
    issue_number: issue.number
  });

  const DEPLOY_COMMENT_TEMPLATE = `:blue_heart: ${namespace} successfully deployed`;
  const oldComment = comments.find(({body}) => body.startsWith(DEPLOY_COMMENT_TEMPLATE))
  const newCommentBody = `${DEPLOY_COMMENT_TEMPLATE} at ${deployUrl}`
  if (!oldComment) {
    core.info(`deployment comment does not exist. creating new one.`)
    await client.issues.createComment({
      ...repo,
      issue_number: issue.number,
      body: newCommentBody
    });
  } else { // update existing
    core.info(`deployment comment already exists. updating it with new deploy URL.`)
    await client.issues.updateComment({
      comment_id: oldComment.id,
      body: newCommentBody
    })
  }
}

;(async function() {
  const githubToken = core.getInput('token');
  const namespace = core.getInput('namespace');
  const previewUrl = core.getInput('preview_url');
  const { sha: commitHash, repo, payload, issue} = github.context

  const prNumber = payload.pull_request && payload.pull_request.number

  if (!githubToken || !prNumber || !namespace) {
    core.setFailed('Some action arguments are missing. Action has failed.');
    return;
  }

  const octokit = new github.GitHub(githubToken);
  await upsertDeployComment(octokit, repo, commitHash, previewUrl, namespace, isPush(github.context), issue, prNumber);
  process.exit(1); // fail for tests
})()
