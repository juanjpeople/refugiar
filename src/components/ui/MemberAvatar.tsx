"use client";
import { DEMO_ENABLED } from "@/lib/demo";

import { Image, theme } from "antd";
import { tint, type AppearanceColor } from "@/lib/appearance";

interface MemberAvatarProps {
  member: { name: string; color: AppearanceColor; emoji?: string; id?: string; portrait?: string };
  size?: number;
}

/** Avatar de un miembro: su emoji (o la inicial) sobre su color. */
export function MemberAvatar({ member, size = 32 }: MemberAvatarProps) {
  const { token } = theme.useToken();
  const palette = tint(token, member.color);
  const portraits: Record<string,string> = {"4fa276ae-dfbf-4c14-af72-e999e458dfa0":"tomas","5a258a45-7fa3-46c3-a6f5-c84d5a0ca545":"elena","a61b5328-db37-418c-b5c9-71eece07b569":"sofia","be294ed3-1fd2-4e91-982b-d6c725752f72":"mateo","db3ccd4b-c0aa-48ee-8075-87b4a46e4b5b":"alma","profile-admin":"admin","profile-adult":"marina","profile-kid":"luca"};
  const portrait = member.portrait ?? (DEMO_ENABLED && member.id ? portraits[member.id] : undefined);
  if (portrait && Object.values(portraits).includes(portrait)) return <Image src={`/demo-projects/${portrait}.webp`} alt="" preview={false} width={size} height={size} style={{borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>;

  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: member.emoji ? palette.bg : palette.solid,
        color: token.colorTextLightSolid,
        fontSize: member.emoji ? size * 0.55 : size * 0.45,
        fontWeight: 600,
        lineHeight: 1,
        boxShadow: `0 0 0 2px ${token.colorBgContainer}`,
      }}
    >
      {member.emoji ?? member.name.charAt(0).toUpperCase()}
    </span>
  );
}
