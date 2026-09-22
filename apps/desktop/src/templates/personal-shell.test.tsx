import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveTemplate: vi.fn(),
  toggleTemplateFavorite: vi.fn(),
  createTemplate: vi.fn(),
  useSharedResources: vi.fn(() => ({ data: [] })),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (message, part, index) =>
          `${message}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      ),
  }),
}));

vi.mock("./queries", () => ({
  getTemplateCopyTitle: (title: string | null) => `${title ?? ""} copy`,
  useSaveTemplate: () => mocks.saveTemplate,
  useToggleTemplateFavorite: () => mocks.toggleTemplateFavorite,
}));

vi.mock("./sections-editor", () => ({
  SectionsList: () => null,
}));

vi.mock("./utils", () => ({
  AUTO_TEMPLATE_ID: "__auto__",
  useTemplateTab: () => ({
    userTemplates: [lectureTemplate],
    webTemplates: [],
    isWebLoading: false,
    isWebMode: false,
    selectedMineId: lectureTemplate.id,
    selectedWebIndex: null,
    setSelectedMineId: vi.fn(),
    setSelectedWebIndex: vi.fn(),
    createTemplate: mocks.createTemplate,
    createDefaultTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    toggleTemplateFavorite: vi.fn(),
  }),
}));

vi.mock("~/resource-sharing/hooks", () => ({
  sharedResourcesQueryKey: () => ["shared-resources"],
  useSharedResources: mocks.useSharedResources,
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValue: () => vi.fn(),
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => "",
}));

vi.mock("~/shared/hooks/useNativeContextMenu", () => ({
  useNativeContextMenu: () => vi.fn(),
}));

vi.mock("~/sidebar/custom-sidebar-header", () => ({
  CustomSidebarHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import type { UserTemplate } from "./queries";
import { TemplateForm } from "./template-form";
import { TemplatesSidebarContent } from "./template-sidebar";

import { PersonalBillingProvider } from "~/auth/personal-billing";
import { PersonalAuthProvider } from "~/auth/personal-context";

const lectureTemplate = {
  id: "template-lecture",
  title: "Lecture",
  description: "",
  category: null,
  icon: null,
  targets: [],
  sections: [],
  pinned: false,
  pinOrder: null,
} as unknown as UserTemplate;

function renderInPersonalShell(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PersonalAuthProvider>
        <PersonalBillingProvider>{children}</PersonalBillingProvider>
      </PersonalAuthProvider>
    </QueryClientProvider>,
  );
}

describe("templates in the personal shell", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mocks.saveTemplate.mockReset();
    mocks.saveTemplate.mockResolvedValue(undefined);
    mocks.useSharedResources.mockClear();
  });

  afterEach(cleanup);

  it("edits a local template without a share control", async () => {
    renderInPersonalShell(
      <TemplateForm
        template={lectureTemplate}
        handleDeleteTemplate={vi.fn()}
        handleDuplicateTemplate={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Share/ })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Enter template title"), {
      target: { value: "Irish lecture" },
    });

    await waitFor(() => {
      expect(mocks.saveTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "template-lecture",
          title: "Irish lecture",
        }),
      );
    });
    expect(mocks.useSharedResources).not.toHaveBeenCalled();
  });

  it("lists local templates without the hosted shared library", () => {
    renderInPersonalShell(
      <TemplatesSidebarContent
        tab={{
          type: "templates",
          active: true,
          pinned: false,
          slotId: "slot-1",
          state: {
            showHomepage: false,
            isWebMode: false,
            selectedMineId: lectureTemplate.id,
            selectedWebIndex: null,
          },
        }}
      />,
    );

    expect(screen.getByText("Lecture")).toBeTruthy();
    expect(screen.queryByText("Shared with me")).toBeNull();
    expect(mocks.useSharedResources).not.toHaveBeenCalled();
  });
});
