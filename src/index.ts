import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-definitions/schema';

import axios from "axios";

const wrikeConfig = {
  url: "https://www.wrike.com/api/v4",
  token: core.getInput('WRIKE_ACCESS_TOKEN'),
};

const apiClient = axios.create({
  baseURL: wrikeConfig.url,
  headers: { 'Authorization': `bearer ${wrikeConfig.token}` },
});

const getTask = async (taskId: string) => (await apiClient.request({ url: `/tasks/${taskId}` })).data.data[0];
const setTask = async (taskId: string, data: object) => await apiClient.request({ url: `/tasks/${taskId}`, method: 'put', data });

const colors = {
  draft: {
    background: 'transparent',
    font: 'gray'
  },
  open: {
    background: '#2da44e',
    font: 'white'
  },
  merged: {
    background: '#8250df',
    font: 'white',
  },
  closed: {
    background: '#cf222e',
    font: 'white',
  }
};

const wrikeTaskIdFromUrl = async (id: string): Promise<string> => {
  const url = `/tasks?permalink=${encodeURIComponent(id)}`;
  const response = await apiClient.request({ url });
  const task = response.data.data[0];
  return task.id;
}

const updateWrikeTicket = async (taskId: string, pullRequestUrl: string, state: State) => {
  const { description } = await getTask(taskId);
  const style = `style="color: ${colors[state].font}; background-color: ${colors[state].background}"`;
  const pullRequest = `${pullRequestUrl} [${state.toUpperCase()}]`;
  const newState = `<div id="github-action-wrike-pr-sync" ${style}>${pullRequest}</div><br />`

  const regexp = new RegExp(`<div id="github-action-wrike-pr-sync".*>${pullRequestUrl}.*</div><br />`);
  const updatedDescription = description.includes(pullRequestUrl)
    ? description.replace(regexp, newState)
    : newState + description;

  await setTask(taskId, { description: updatedDescription });
}

const error = (message: string): void => core.setFailed(message);

type State = 'draft' | 'open' | 'merged' | 'closed';

(async () => {
  const payload = github.context.payload as PullRequestEvent;
  const { pull_request } = payload;
  if (!pull_request) return error('Not a pull request.');
  const { body, html_url, merged, draft, state } = pull_request;
  if (!html_url) return error('Could not determine PR URL.');
  if (!body) return error('Missing description.');
  const wrikeUrls = body.match(/https:\/\/www.wrike.com\/open.htm\?id=(\d+)/g);
  if (!wrikeUrls) return error('PR does not contain a Wrike link.');

  const wrikeIds = await Promise.all(wrikeUrls.map(wrikeTaskIdFromUrl));
  core.warning(wrikeIds.toString());

  const update = (state: State) => Promise.all(wrikeIds.map(id => updateWrikeTicket(id, html_url, state)));

  if (merged) await update('merged')
  else if (state === 'closed') await update('closed')
  else if (draft) await update('draft')
  else await update('open');

})().catch((e) => {
  core.error(e.message);
  core.error(JSON.stringify(e));
  core.setFailed(e);
});