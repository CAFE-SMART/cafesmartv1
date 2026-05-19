import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  method: string;
  url: string;
  route: string;
  getUserId?: () => string | undefined;
  organizationIdByUserId?: Map<string, string>;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T) {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getCachedOrganizationId(userId: string): string | undefined {
  return requestContextStorage.getStore()?.organizationIdByUserId?.get(userId);
}

export function setCachedOrganizationId(userId: string, organizationId: string) {
  const context = requestContextStorage.getStore();
  if (!context) return;
  if (!context.organizationIdByUserId) {
    context.organizationIdByUserId = new Map<string, string>();
  }
  context.organizationIdByUserId.set(userId, organizationId);
}
