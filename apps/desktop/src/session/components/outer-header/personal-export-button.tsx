import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";

import { FileArrowDown } from "@anlg/ui/components/icons";
import { Button } from "@anlg/ui/components/ui/button";

import { ExportModal } from "./overflow/export-modal";

import type { EditorView } from "~/store/zustand/tabs/schema";

export function PersonalExportButton({
  sessionId,
  currentView,
}: {
  sessionId: string;
  currentView: EditorView;
}) {
  const { t } = useLingui();
  const [hasOpened, setHasOpened] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-tauri-drag-region="false"
        aria-label={t`Export note`}
        title={t`Export note`}
        className="max-w-56 gap-1.5 overflow-hidden border pr-2.5 pl-1.5 text-sm shadow-none"
        onClick={() => {
          setHasOpened(true);
          requestAnimationFrame(() => setOpen(true));
        }}
      >
        <FileArrowDown className="size-3.5" aria-hidden="true" />
        <span className="truncate">
          <Trans>Export</Trans>
        </span>
      </Button>
      {hasOpened ? (
        <ExportModal
          sessionId={sessionId}
          currentView={currentView}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
