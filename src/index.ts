import * as core from '@actions/core';
import * as github from '@actions/github';

import axios from "axios";

const wrikeConifg = {
  url: "https://www.wrike.com/api/v4",
  token: core.getInput('WRIKE_ACCESS_TOKEN'),
  reviewState: core.getInput('WRIKE_IN_REVIEW_STATE_ID'),
  mergeState: core.getInput('WRIKE_MERGED_STATE_ID'),
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

const wrikeTaskIdFromUrl = async (url: string) => {
  const res = await apiClient.request({
    url: `/tasks?permalink=${encodeURIComponent(url)}`,
  });
  const task = res.data.data[0];
  return task ? task.id : null
}

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
      description: '<span style="background-color: #B0D300;">Pull-Request:</span> ' + pullRequestUrl + '<br /><br />' + description,
      customFields: {
        customStatus: newState,
      },
    },
  });
}

(async () => {
  core.warning('👋 Hello! 🙌')
  console.log('starting this fancy action');
  const payload = github.context.payload;

  core.warning('github payload');
  core.warning(JSON.stringify(payload));
  core.warning(JSON.stringify(wrikeConifg));


  if (!payload.pull_request) {
    core.setFailed("This action is for pull request events. Please set 'on: pull_request' in your workflow");
    return;
  }

  const { body, html_url } = payload.pull_request;

  core.warning(String(body));
  core.warning(String(html_url));
  core.warning(wrikeConifg.token);

  if(body === undefined || html_url === undefined) {
    core.setFailed("PR does not contain a description. So no wrike ticket to find");
    return;
  }

  const wrikeUrls = await wrikeUrlsFromBody(body);
  core.warning(wrikeUrls.toString());

  if (wrikeUrls.length === 0) {
    core.setFailed("PR does not contain a Wrike link");
    return
  }

  try {
    const wrikeIds = await Promise.all(wrikeUrls.map(url => wrikeTaskIdFromUrl(url)));
    core.warning(wrikeIds.toString());

    if (payload.pull_request.merged == true) {
      console.log('PR merged...');
      console.log('Following IDs found:', wrikeIds);

      try {
        await Promise.all(wrikeIds.map((id) => updateWrikeTicket(id, html_url, wrikeConifg.reviewState)));
        return;
      } catch (e) {
        core.setFailed(e);
      }
      return;
    }

    try {
      await Promise.all(wrikeIds.map((id) => updateWrikeTicket(id, html_url, wrikeConifg.reviewState)));
    } catch (e) {
      core.setFailed(e);
    }

  } catch (e) {
    core.setFailed(e);
    return;
  }
})().catch((e) => {
  core.setFailed(e);
});
