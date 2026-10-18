"use client";
import { Image, theme } from "antd";
import { useT } from "@/i18n";
/** An illustrative cover; never presented as an actual project photo. */
export function ProjectCover({ src }: { src: string }) {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <Image
      src={src}
      alt={t("projects.demoImage")}
      title={t("projects.demoImage")}
      preview={false}
      width="100%"
      style={{
        aspectRatio: "3 / 2",
        objectFit: "cover",
        borderRadius: token.borderRadiusLG,
      }}
    />
  );
}
