import { BaseResource, type RequestOptions } from '../core/resource/base-resource.js';
import { toFormData } from '../core/http/form-data.js';
import type { question } from '../generated/index.js';

const MODULE = 'question';

/**
 * Customer questions — `api-asktoseller-merchant`.
 *
 * The only product that numbers pages from **1**. Everything else that pages by number starts at
 * 0, so a shared "page 0" default silently asks this one for a page that does not exist.
 */
export class QuestionsResource extends BaseResource {
  /** Questions addressed to this merchant. */
  list(query: question.GetIssuesQuery = {}, options: RequestOptions = {}): Promise<question.GetIssuesResponse> {
    return this.transport.request<question.GetIssuesResponse>({
      operationId: 'getIssues',
      module: MODULE,
      method: 'GET',
      path: '/api/v1.0/issues',
      query: { ...query },
      ...this.options(options),
    });
  }

  /** How many questions are outstanding. */
  count(options: RequestOptions = {}): Promise<question.GetIssuesCountResponse> {
    return this.transport.request<question.GetIssuesCountResponse>({
      operationId: 'getIssuesCount',
      module: MODULE,
      method: 'GET',
      path: '/api/v1.0/issues/count',
      ...this.options(options),
    });
  }

  /** One question in full. */
  get(issueNumber: string | number, options: RequestOptions = {}): Promise<question.GetIssuesByNumberResponse> {
    return this.transport.request<question.GetIssuesByNumberResponse>({
      operationId: 'getIssuesByNumber',
      module: MODULE,
      method: 'GET',
      path: '/api/v1.0/issues/{number}',
      pathParams: { number: issueNumber },
      ...this.options(options),
    });
  }

  /** Raise a question. */
  create(body: question.PostIssuesBody, options: RequestOptions = {}): Promise<question.PostIssuesResponse> {
    return this.transport.request<question.PostIssuesResponse>({
      operationId: 'postIssues',
      module: MODULE,
      method: 'POST',
      path: '/api/v1.0/issues',
      body,
      ...this.options(options),
    });
  }

  /** Answer a question. Sent as multipart, because an answer may carry attachments. */
  answer(
    issueNumber: string | number,
    body: question.PostIssuesAnswerBody,
    options: RequestOptions = {}
  ): Promise<question.PostIssuesAnswerResponse> {
    return this.transport.request<question.PostIssuesAnswerResponse>({
      operationId: 'postIssuesAnswer',
      module: MODULE,
      method: 'POST',
      path: '/api/v1.0/issues/{number}/answer',
      pathParams: { number: issueNumber },
      body: toFormData(body),
      ...this.options(options),
    });
  }

  /** Decline to answer a question. */
  reject(
    issueNumber: string | number,
    body: question.PostIssuesRejectBody,
    options: RequestOptions = {}
  ): Promise<question.PostIssuesRejectResponse> {
    return this.transport.request<question.PostIssuesRejectResponse>({
      operationId: 'postIssuesReject',
      module: MODULE,
      method: 'POST',
      path: '/api/v1.0/issues/{number}/reject',
      pathParams: { number: issueNumber },
      body,
      ...this.options(options),
    });
  }
}
