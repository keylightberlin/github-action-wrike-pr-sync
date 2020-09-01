import * as core from '@actions/core';
import * as github from '@actions/github';

import axios from "axios";

const wrikeConifg = {
  url: "https://www.wrike.com/api/v4/",
  token: core.getInput('WRIKE_ACCESS_TOKEN'),
  reviewState: core.getInput('WRIKE_IN_REVIEW_STATE'),
  mergeState: core.getInput('WRIKE_MERGED_STATE'),
};

const apiClient = axios.create({
  baseURL: wrikeConifg.url,
  headers: { 'Authorization': `bearer ${wrikeConifg.token}` },
});



const wrikeUrlsFromBody = (body: string): string[] => {
  const matched = body.match(/https:\/\/www.wrike.com\/open.htm\?id=(\d+)/g);
  if (!matched) {
    return [];
  }

  return matched;
}

/*
const wrikeTaskIdFromUrl = async (url: string) => {
  const res = await instance.request({
    url: `/tasks?permalink=${encodeURIComponent(url)}`,
  });
  const task = res.data.data[0];
  return task ? task.id : null
}
*/

const updateWrikeTicket = async (
    id: string,
    pullRequestUrl: string,
    newState: string,
) => {
  const res = await apiClient.request({
    url: `/tasks/${id}`,
  });
  const task = res.data.data[0];
  const description = task.description;

  if (description.indexOf(pullRequestUrl) != -1) { // pullreq url has already been linked.
    console.log('pullreq url: ' + pullRequestUrl + ' has already been linked.')
    return;
  }

  await apiClient.request({
    url: `/tasks/${id}`,
    method: 'put',
    data: {
      description: '<span style="background-color: #966AF0;">Pull-Request:</span> ' + pullRequestUrl + '<br /><br />' + description,
      customFields: {
        customStatus: newState,
      },
    },
  });
}

(async (evt) => {
  const payload = github.context.payload;
  if (!payload.pull_request) {
    core.setFailed("This action is for pull request events. Please set 'on: pull_request' in your workflow");
    return;
  }

  const { body, html_url } = payload.pull_request;

  if(body === undefined || html_url === undefined) {
    core.setFailed("PR does not contain a description. So no wrike ticket to find");
    return;
  }

  const wrikeIds = await wrikeUrlsFromBody(body);
  console.log(wrikeIds);
  // @todo what's in there?


  if (payload.pull_request.merged == true) {
    // @todo update the wrike ticket to the merged state
    console.log('PR merged...');

    try {
      await Promise.all(wrikeIds.map((id) => updateWrikeTicket(id, html_url, wrikeConifg.mergeState)));
    } catch (e) {
      core.setFailed(e);
    }

    return;
  }

  // @todo new PR case

  console.log(evt);


  console.log(body);
  console.log(html_url);
  console.log(payload.pull_request);


  // @todo is this a new PR or merge?

  try {
    await Promise.all(wrikeIds.map((id) => updateWrikeTicket(id, html_url, wrikeConifg.reviewState)));
  } catch (e) {
    core.setFailed(e);
  }
})().catch((e) => {
  core.setFailed(e);
});
