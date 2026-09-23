import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef } from "react";

import {
  ArrowsClockwise,
  CircleNotch,
  DownloadSimple,
  PlugsConnected,
} from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import {
  cancelConnectedImport,
  connectConnectedImport,
  connectedImportCredentialsQueryKey,
  connectedImportCredentialsQueryOptions,
  connectedImportSyncQueryKey,
  connectedImportSyncQueryOptions,
  disconnectConnectedImport,
} from "./connected-import";
import type { MeetingImportProvider } from "./providers";

/// A meeting app Dialext connects to directly from this Mac (its MCP server or CLI).
/// Nothing here needs an account or a Dialext server: sign-in happens in the browser
/// with the provider, and the token stays in the Keychain.
export function LocalConnectorRow({
  provider,
  icon,
  importingFiles,
  fileImportPending,
  onChooseFiles,
}: {
  provider: MeetingImportProvider;
  icon: ReactNode;
  importingFiles: boolean;
  fileImportPending: boolean;
  onChooseFiles: () => void;
}) {
  const queryClient = useQueryClient();
  const abortController = useRef<AbortController | null>(null);
  const credentials = useQuery(
    connectedImportCredentialsQueryOptions(provider.id),
  );
  const connected = Boolean(credentials.data);
  const sync = useQuery(connectedImportSyncQueryOptions(provider, connected));

  const connect = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      abortController.current = controller;
      try {
        return await connectConnectedImport(provider, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return null;
        throw error;
      } finally {
        if (abortController.current === controller) {
          abortController.current = null;
        }
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.setQueryData(
        connectedImportCredentialsQueryKey(provider.id),
        result,
      );
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelConnectedImport(provider.id),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectConnectedImport(provider.id),
    onSuccess: async () => {
      queryClient.setQueryData(
        connectedImportCredentialsQueryKey(provider.id),
        null,
      );
      const queryKey = connectedImportSyncQueryKey(provider.id);
      await queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    },
  });

  const error =
    credentials.error ??
    connect.error ??
    cancel.error ??
    disconnect.error ??
    sync.error;
  const result = sync.data?.result;

  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {provider.name}
        </span>
        <p className="text-muted-foreground mt-1 text-xs">
          {connected ? (
            result ? (
              <Trans>
                Last import: {result.imported} added, {result.matched} unchanged
              </Trans>
            ) : (
              <Trans>
                Connected. New meetings come in automatically while Dialext is
                open.
              </Trans>
            )
          ) : (
            <Trans>
              Connect once to bring over your {provider.name} history and keep
              new meetings coming in.
            </Trans>
          )}
        </p>
        {error ? (
          <p className="text-destructive mt-1 text-xs">{error.message}</p>
        ) : null}
        {(sync.data?.warnings ?? []).map((warning) => (
          <p key={warning} className="text-muted-foreground mt-1 text-xs">
            {warning}
          </p>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {connected ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sync.isFetching}
              onClick={() => void sync.refetch()}
            >
              {sync.isFetching ? (
                <CircleNotch className="size-3.5 animate-spin" />
              ) : (
                <ArrowsClockwise className="size-3.5" />
              )}
              <Trans>Sync now</Trans>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={sync.isFetching || disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              <Trans>Disconnect</Trans>
            </Button>
          </>
        ) : connect.isPending ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => {
              abortController.current?.abort();
              cancel.mutate();
            }}
          >
            <CircleNotch className="size-3.5 animate-spin" />
            <Trans>Cancel</Trans>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={credentials.isPending}
            onClick={() => connect.mutate()}
          >
            <PlugsConnected className="size-3.5" />
            <Trans>Connect & import</Trans>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={fileImportPending}
          onClick={onChooseFiles}
        >
          {importingFiles ? (
            <CircleNotch className="size-3.5 animate-spin" />
          ) : (
            <DownloadSimple className="size-3.5" />
          )}
          <Trans>Choose files</Trans>
        </Button>
      </div>
    </div>
  );
}
