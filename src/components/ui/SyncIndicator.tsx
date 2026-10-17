"use client";

import { Badge, Button, Tooltip, theme } from "antd";
import { CloudCheck, CloudOff, HardDrive, LoaderCircle, TriangleAlert } from "lucide-react";

/** Estado compacto con nombre accesible; el detalle se abre al tocarlo. */
export function SyncIndicator({ state, label, pending = 0, onClick }: { state: "local" | "waiting" | "synced" | "offline" | "error"; label: string; pending?: number; onClick: () => void }) {
  const { token } = theme.useToken();
  const Icon = { local: HardDrive, waiting: LoaderCircle, synced: CloudCheck, offline: CloudOff, error: TriangleAlert }[state];
  const color = state === "error" ? token.colorError : state === "offline" || pending > 0 ? token.colorWarning : token.colorTextSecondary;
  return <Tooltip title={label}><Badge dot={pending > 0 || state === "error"} color={color} offset={[-token.marginXS, token.marginXS]}>
    <Button type="text" aria-label={label} onClick={onClick} icon={<Icon />} style={{ color, minHeight: token.controlHeightLG, minWidth: token.controlHeightLG }} />
  </Badge></Tooltip>;
}
