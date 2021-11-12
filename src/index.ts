import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequest, PullRequestEvent } from '@octokit/webhooks-definitions/schema';

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
  draft: 'gray',
  open: '#2da44e',
  merged: '#8250df',
  closed: '#cf222e',
};

const wrikeTaskIdFromUrl = async (id: string): Promise<string> => {
  const url = `/tasks?permalink=${encodeURIComponent(id)}`;
  const response = await apiClient.request({ url });
  const task = response.data.data[0];
  return task.id;
}

const colorSpan = (color: string, inner: string) => `<span style="color: ${color};">${inner}</span>`;
const backgroundSpan = (color: string, inner: string) => `<span style="background-color: ${color};">${inner}</span>`;

const updateWrikeTicket = async (taskId: string, { html_url, number, title }: PullRequest, state: State) => {
  core.info(`Setting task ${taskId} to ${state}.`);
  
  const { description } = await getTask(taskId);
  core.info(`Current description is: ${description}`);

  const color = colors[state];

  const prDescription = colorSpan(color, `Pull request ${number}: ${title}`);
  const prStateLabel = backgroundSpan(color, colorSpan('white', `[${state.toUpperCase()}]`));
  const newState = `<a href="${html_url}">${prDescription} ${prStateLabel}</a><br />`;


  const regexp = new RegExp(`<a href="${html_url}">.*</a><br />`);
  const updatedDescription = description.includes(html_url)
    ? description.replace(regexp, newState)
    : newState + description;

  await setTask(taskId, { description: updatedDescription });
}

const error = (message: string): void => core.setFailed(message);

type State = 'draft' | 'open' | 'merged' | 'closed';

(async () => {
  const payload = github.context.payload as PullRequestEvent;
  const { pull_request } = payload;
  if (!pull_request) throw Error('Not a pull request.');
  const { body, merged, draft, state } = pull_request;
  if (!body) return error('Missing description.');
  const wrikeUrls = body.match(/https:\/\/www.wrike.com\/open.htm\?id=(\d+)/g);
  if (!wrikeUrls) return error('PR does not contain a Wrike link.');

  const wrikeIds = await Promise.all(wrikeUrls.map(wrikeTaskIdFromUrl));
  core.warning(wrikeIds.toString());

  const update = (state: State) => Promise.all(wrikeIds.map(id => updateWrikeTicket(id, pull_request, state)));

  if (merged) await update('merged')
  else if (state === 'closed') await update('closed')
  else if (draft) await update('draft')
  else await update('open');

})().catch((e) => {
  core.error(e.message);
  core.error(JSON.stringify(e));
  core.setFailed(e);
});