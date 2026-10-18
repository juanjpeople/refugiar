"use client";
/* eslint-disable @next/next/no-img-element -- bounded, validated raster bytes; no remote optimizer. */
import { App, Button, Checkbox, Flex, Tag, Typography, theme } from "antd";
import { useMemo } from "react";
import { ShareCard } from "@/components/ui";
import { useI18n } from "@/i18n";
import { downloadBlob } from "@/lib/download";
import { fromB64u } from "@/lib/crypto";
import { imageMime } from "./attachments";
import { contentText } from "./format";
import { sharedName, type SharedContentV1, type ShareMark } from "./domain";

export function ContentPreview({
  content,
  marks = [],
  onCheck,
  busy = false,
}: {
  content: SharedContentV1;
  marks?: ShareMark[];
  onCheck?: (item: ShareMark, checked: boolean) => void;
  busy?: boolean;
}) {
  const { t } = useI18n(),
    { token } = theme.useToken();
  return (
    <ShareCard title={sharedName(content)}>
      {content.kind === "shopping-list" ? (
        <Flex vertical gap={token.marginSM}>
          {content.items.map((item) => {
            const mark = marks.find((m) => m.id === item.id) ?? {
              id: item.id,
              revision: 0,
              checked: false,
              received: false,
            };
            return (
              <Flex
                key={item.id}
                align="center"
                justify="space-between"
                gap={token.marginSM}
              >
                <Checkbox
                  disabled={!onCheck || busy || mark.received || item.bought}
                  checked={item.bought || mark.checked}
                  onChange={(event) => onCheck?.(mark, event.target.checked)}
                >
                  {item.name} · {item.quantity} {item.unit}
                </Checkbox>
                {(mark.received || item.bought) && (
                  <Tag>{t("sharing.received")}</Tag>
                )}
                {item.estimateCents !== undefined && (
                  <Typography.Text type="secondary">
                    {content.currency} {(item.estimateCents / 100).toFixed(2)}
                  </Typography.Text>
                )}
              </Flex>
            );
          })}
        </Flex>
      ) : (
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {contentText(content, t).split("\n").slice(1).join("\n")}
        </Typography.Paragraph>
      )}
      {content.attachments.map((file, index) => (
        <SharedAttachment key={`${index}:${file.name}`} file={file} />
      ))}
    </ShareCard>
  );
}
function SharedAttachment({
  file,
}: {
  file: SharedContentV1["attachments"][number];
}) {
  const { t } = useI18n(),
    { token } = theme.useToken(),
    { message } = App.useApp();
  const media = useMemo(() => {
    const bytes = new Uint8Array(fromB64u(file.data));
    const mime = file.image ? imageMime(bytes) : null;
    const blob = new Blob([bytes], {
      type: mime ?? "application/octet-stream",
    });
    return { blob, mime };
  }, [file]);
  // A data URL remains only in this rendered tree; there is no object-URL cache to retain.
  const url = media.mime
    ? `data:${media.mime};base64,${file.data.replace(/-/g, "+").replace(/_/g, "/")}`
    : null;
  return (
    <Flex vertical gap={token.marginXS}>
      {url && (
        <img
          src={url}
          alt={file.name}
          style={{
            maxWidth: "100%",
            maxHeight: token.controlHeightLG * 8,
            objectFit: "contain",
            borderRadius: token.borderRadiusLG,
          }}
        />
      )}
      <Button
        onClick={() =>
          void downloadBlob(media.blob, file.name).catch(() =>
            message.error(t("sharing.error")),
          )
        }
      >
        {t("sharing.download", { name: file.name })}
      </Button>
    </Flex>
  );
}
