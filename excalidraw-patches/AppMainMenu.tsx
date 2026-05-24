import React from "react";
import { MainMenu } from "@excalidraw/excalidraw/index";

import {
  GithubIcon,
  saveAs,
  extraToolsIcon,
} from "@excalidraw/excalidraw/components/icons";

import DropdownMenuItemLink from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItemLink";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import type { Theme } from "@excalidraw/element/types";

import { useAtom, useSetAtom, userAtom, saveAsDialogAtom } from "../app-jotai";
import { LanguageList } from "../app-language/LanguageList";

const AboutDialog = ({ onClose }: { onClose: () => void }) => (
  <Dialog onCloseRequest={onClose} title="About">
    <div style={{ padding: "0 1.5rem 1.5rem", lineHeight: 1.6 }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem" }}>
        Excalidraw — Pi Self-Hosted
      </h2>
      <p style={{ margin: "0 0 1rem", opacity: 0.7, fontSize: "0.9rem" }}>
        A private collaborative whiteboard for friends.
      </p>
      <div style={{ fontSize: "0.85rem" }}>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong>Auth:</strong> Pocket-ID (OIDC)
        </p>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong>Storage:</strong> SQLite + disk-backed file store
        </p>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong>Collab:</strong> Real-time via WebSocket with image sync
        </p>
        <p style={{ margin: "0 0 1rem" }}>
          <strong>Host:</strong> Raspberry Pi 5
        </p>
        <hr style={{ border: "none", borderTop: "1px solid var(--button-gray-2)", margin: "1rem 0" }} />
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", opacity: 0.6 }}>
          Forked from{" "}
          <a href="https://github.com/BetterAndBetterII/excalidraw-full" target="_blank" rel="noopener" style={{ color: "var(--color-primary)" }}>
            BetterAndBetterII/excalidraw-full
          </a>
        </p>
        <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6 }}>
          Built with{" "}
          <a href="https://excalidraw.com" target="_blank" rel="noopener" style={{ color: "var(--color-primary)" }}>
            Excalidraw
          </a>
        </p>
      </div>
    </div>
  </Dialog>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  onStorageSettingsClick: () => void;
}> = React.memo((props) => {
  const [user, setUser] = useAtom(userAtom);
  const setSaveAsDialog = useSetAtom(saveAsDialogAtom);
  const [showAbout, setShowAbout] = React.useState(false);

  const handleLogin = () => {
    window.location.href = "/auth/login";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    window.location.reload(); // Reload to clear all state
  };

  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.Item
        onSelect={() => setSaveAsDialog({ isOpen: true })}
        icon={saveAs}
      >
        Save as New Canvas...
      </MainMenu.Item>
      <MainMenu.DefaultItems.Export />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.Item
        onSelect={props.onStorageSettingsClick}
        icon={extraToolsIcon}
      >
        Data Source Settings...
      </MainMenu.Item>
      <MainMenu.Separator />
      {user ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            padding: "0 0.5rem",
            width: "100%",
            fontSize: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              overflow: "hidden",
              flexShrink: 1,
            }}
          >
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.login}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name || user.login}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              textAlign: "center",
              color: "inherit",
              flexShrink: 0,
              marginRight: "1rem",
              font: "var(--ui-font)",
              fontSize: "14px",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "var(--button-gray-1)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Logout
          </button>
        </div>
      ) : (
        <MainMenu.Item onSelect={handleLogin} icon={GithubIcon}>
          Login
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <DropdownMenuItemLink
        icon={GithubIcon}
        href="https://github.com/sametbellur/excalidraw-pi"
        aria-label="GitHub"
      >
        GitHub
      </DropdownMenuItemLink>
      <MainMenu.Item onSelect={() => setShowAbout(true)}>
        About
      </MainMenu.Item>
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
