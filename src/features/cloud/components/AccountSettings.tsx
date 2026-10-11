"use client";

import { Alert, App, Button, Flex, Form, Input, Modal, Progress, Tag, Tooltip, Typography, theme } from "antd";
import { KeyRound, Lock, LogIn, LogOut, Monitor, Smartphone, UserX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingRow, LoadingSkeleton } from "@/components/ui";
import { useI18n, useT } from "@/i18n";
import { describeUserAgent, deviceLabel } from "@/lib/device";
import { getErrorMessage } from "@/lib/errors";
import { PASSWORD_MIN_LENGTH, passwordStrength, type CloudDevice, type CloudHousehold } from "../domain";
import { useCloudSession, useCloudStore } from "../hooks";
import * as service from "../service";
import { getSyncLink, leaveCloudOnDevice } from "../sync";
import { RecoveryKit } from "./RecoveryKit";
import { SocialAccess } from "./SocialAccess";
import { TwoFactorSettings } from "./TwoFactorSettings";

/**
 * Ajustes → Cuenta: la contraseña, el kit de recuperación, la verificación en dos pasos, los
 * dispositivos donde está abierta y borrar la cuenta.
 * Solo con la nube habilitada y la cuenta abierta en este dispositivo.
 */
export function AccountSettings() {
  const t = useT();
  const { status, session } = useCloudSession();
  const [dialog, setDialog] = useState<"password" | "kit" | "delete" | null>(null);

  if (status === "idle" || status === "restoring") return <LoadingSkeleton paragraph={{ rows: 3 }} style={{ paddingBlock: 16 }} />;
  if (!session) {
    return (
      <SettingRow label={t("cloud.account.signedOutTitle")} description={t("cloud.account.signedOutText")} last>
        <Link href="/cuenta?modo=entrar">
          <Button icon={<LogIn />}>{t("cloud.auth.signIn")}</Button>
        </Link>
      </SettingRow>
    );
  }

  return (
    <>
      <SettingRow label={session.user.name} description={session.user.email}>
        <Tag color="success" style={{ margin: 0 }}>
          {t("cloud.account.encrypted")}
        </Tag>
      </SettingRow>
      <SettingRow label={t("cloud.account.passwordTitle")} description={t("cloud.account.passwordText")}>
        <Button icon={<Lock />} onClick={() => setDialog("password")}>
          {t("cloud.account.passwordButton")}
        </Button>
      </SettingRow>
      <SettingRow label={t("cloud.account.kitTitle")} description={t("cloud.account.kitText")}>
        <Button icon={<KeyRound />} onClick={() => setDialog("kit")}>
          {t("cloud.account.kitButton")}
        </Button>
      </SettingRow>
      <TwoFactorSettings />
      <SettingRow label={t("cloud.account.devicesTitle")} description={t("cloud.account.devicesText")} stacked>
        <Devices />
      </SettingRow>
      <SocialAccess mode="link" />
      <SettingRow label={t("cloud.account.delete.title")} description={t("cloud.account.delete.text")} last>
        <Button danger icon={<UserX />} onClick={() => setDialog("delete")}>
          {t("cloud.account.delete.button")}
        </Button>
      </SettingRow>
      <ChangePasswordModal open={dialog === "password"} onClose={() => setDialog(null)} />
      <NewKitModal open={dialog === "kit"} onClose={() => setDialog(null)} />
      <Modal open={dialog === "delete"} title={t("cloud.account.delete.confirmTitle")} onCancel={() => setDialog(null)} footer={null} destroyOnHidden>
        <DeleteAccountForm onCancel={() => setDialog(null)} />
      </Modal>
    </>
  );
}

/**
 * Borrar la cuenta. Primero se fija si administra sola una casa con más gente (eso lo frena), dice
 * qué se borra y qué queda, y pide escribir el email. Si este dispositivo sincroniza con esta
 * cuenta, también queda vacío: su casa era la de la cuenta.
 */
function DeleteAccountForm({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const session = useCloudStore((s) => s.session);
  const [blocking, setBlocking] = useState<CloudHousehold[] | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = Boolean(session) && getSyncLink()?.userId === session?.user.id;

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    service
      .householdsBlockingDeletion(session)
      .then((list) => !cancelled && setBlocking(list))
      .catch((error: unknown) => {
        if (cancelled) return;
        setBlocking([]);
        message.error(getErrorMessage(error, t));
      });
    return () => {
      cancelled = true;
    };
  }, [session, message, t]);

  async function onFinish({ email }: { email: string }) {
    setBusy(true);
    try {
      await service.deleteAccount(email);
      message.success(t("cloud.account.delete.done"));
      if (linked) {
        await leaveCloudOnDevice({ wipe: true });
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- la base local se borró: la app tiene que arrancar de cero, no navegar.
        window.location.assign("/bienvenida");
        return;
      }
      useCloudStore.getState().setSession(null);
    } catch (error) {
      message.error(getErrorMessage(error, t));
      setBusy(false);
    }
  }

  if (!session || !blocking) return <LoadingSkeleton paragraph={{ rows: 3 }} style={{ paddingBlock: 16 }} />;
  if (blocking.length > 0) {
    return (
      <Flex vertical gap={16} style={{ marginTop: 16 }}>
        <Alert type="warning" showIcon title={t("cloud.account.delete.blocked", { houses: blocking.map((household) => household.name || t("cloud.panel.unnamed")).join(", ") })} />
        <Typography.Text type="secondary">{t("cloud.account.delete.blockedHow")}</Typography.Text>
        <Link href="/familia#nube" onClick={onCancel}>
          <Button type="primary" block>
            {t("cloud.account.delete.goFamily")}
          </Button>
        </Link>
      </Flex>
    );
  }

  const items: ("account" | "alone" | "shared" | "device")[] = linked ? ["account", "alone", "shared", "device"] : ["account", "alone", "shared"];
  return (
    <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy} style={{ marginTop: 16 }}>
      <ul style={{ paddingInlineStart: token.paddingLG, marginBlock: 0, marginBottom: token.margin }}>
        {items.map((item) => (
          <li key={item} style={{ marginBottom: token.marginXS }}>
            <Typography.Text>{t(`cloud.account.delete.what.${item}`)}</Typography.Text>
          </li>
        ))}
      </ul>
      <Form.Item
        name="email"
        label={t("cloud.account.delete.emailLabel", { email: session.user.email })}
        rules={[
          {
            validator: (_, value?: string) =>
              value?.trim().toLowerCase() === session.user.email.toLowerCase() ? Promise.resolve() : Promise.reject(new Error(t("cloud.account.delete.mismatch"))),
          },
        ]}
      >
        <Input type="email" autoComplete="off" autoFocus />
      </Form.Item>
      <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {t("cloud.account.delete.final")}
      </Typography.Paragraph>
      <Button type="primary" danger htmlType="submit" block loading={busy} icon={<UserX />}>
        {busy ? t("cloud.auth.working") : t("cloud.account.delete.confirm")}
      </Button>
    </Form>
  );
}

/** Dónde está abierta la cuenta. Cerrar la sesión de uno lo deja sin sincronizar (su copia queda). */
function Devices() {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [devices, setDevices] = useState<CloudDevice[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    service
      .listDevices()
      .then((list) => !cancelled && setDevices(list))
      .catch((error: unknown) => !cancelled && message.error(getErrorMessage(error, t)));
    return () => {
      cancelled = true;
    };
  }, [version, message, t]);

  function revoke(device: CloudDevice) {
    modal.confirm({
      title: t("cloud.account.revokeTitle", { device: deviceLabel(device.userAgent) || t("cloud.account.unknownDevice") }),
      content: t("cloud.account.revokeText"),
      okText: t("cloud.account.revoke"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        try {
          await service.revokeDevice(device.id);
          message.success(t("cloud.account.revoked"));
          setVersion((current) => current + 1);
        } catch (error) {
          message.error(getErrorMessage(error, t));
        }
      },
    });
  }

  if (!devices) return <LoadingSkeleton paragraph={{ rows: 2 }} />;
  return (
    <Flex vertical gap={8}>
      {devices.map((device) => {
        const { mobile } = describeUserAgent(device.userAgent);
        const Icon = mobile ? Smartphone : Monitor;
        return (
          <Flex
            key={device.id}
            align="center"
            gap={12}
            style={{ padding: "10px 12px", borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, background: device.current ? token.colorPrimaryBg : undefined }}
          >
            <span aria-hidden style={{ display: "inline-flex", color: device.current ? token.colorPrimary : token.colorTextSecondary }}>
              <Icon />
            </span>
            <Flex vertical style={{ flex: 1, minWidth: 0 }}>
              <Flex align="center" gap={8} wrap>
                <Typography.Text strong ellipsis>
                  {deviceLabel(device.userAgent) || t("cloud.account.unknownDevice")}
                </Typography.Text>
                {device.current && (
                  <Tag color="processing" style={{ margin: 0 }}>
                    {t("cloud.account.thisDevice")}
                  </Tag>
                )}
              </Flex>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("cloud.account.lastActive", { time: format.relative(device.lastActiveAt) })} · {t("cloud.account.since", { date: format.date(device.createdAt, { day: "numeric", month: "short" }) })}
              </Typography.Text>
            </Flex>
            {!device.current && (
              <Tooltip title={t("cloud.account.revoke")}>
                <Button type="text" danger icon={<LogOut />} aria-label={t("cloud.account.revoke")} onClick={() => revoke(device)} />
              </Tooltip>
            )}
          </Flex>
        );
      })}
    </Flex>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ current: string; next: string; confirm: string }>();
  const [busy, setBusy] = useState(false);
  const next = Form.useWatch("next", form) ?? "";
  const strength = passwordStrength(next);
  const strengthColor = [token.colorError, token.colorError, token.colorWarning, token.colorSuccess, token.colorSuccess][strength];

  async function onFinish(values: { current: string; next: string }) {
    const session = useCloudStore.getState().session;
    if (!session) return;
    setBusy(true);
    try {
      await service.changePassword(session, values);
      message.success(t("cloud.account.passwordChanged"));
      form.resetFields();
      onClose();
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={t("cloud.account.passwordTitle")} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy} style={{ marginTop: 16 }}>
        <Form.Item name="current" label={t("cloud.account.currentPassword")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
          <Input.Password autoComplete="current-password" autoFocus />
        </Form.Item>
        <Form.Item
          name="next"
          label={t("cloud.recover.newPassword")}
          extra={t("cloud.auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
          rules={[
            { required: true, message: t("cloud.auth.passwordRequired") },
            { min: PASSWORD_MIN_LENGTH, message: t("cloud.auth.passwordShort", { min: PASSWORD_MIN_LENGTH }) },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <div style={{ marginTop: -12, marginBottom: 16 }}>
          <Progress percent={(strength / 4) * 100} showInfo={false} size="small" strokeColor={strengthColor} />
        </div>
        <Form.Item
          name="confirm"
          label={t("cloud.auth.confirm")}
          dependencies={["next"]}
          rules={[
            { required: true, message: t("cloud.auth.passwordRequired") },
            ({ getFieldValue }) => ({
              validator: (_, value) => (value === getFieldValue("next") ? Promise.resolve() : Promise.reject(new Error(t("cloud.auth.mismatch")))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("cloud.account.passwordText")}
        </Typography.Paragraph>
        <Button type="primary" htmlType="submit" block loading={busy}>
          {busy ? t("cloud.auth.working") : t("cloud.account.passwordButton")}
        </Button>
      </Form>
    </Modal>
  );
}

/** Kit nuevo: pide la contraseña (abre las claves para cifrarlas con el kit nuevo) y lo muestra una vez. */
function NewKitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const session = useCloudStore((s) => s.session);

  async function onFinish({ password }: { password: string }) {
    if (!session) return;
    setBusy(true);
    try {
      setCode(await service.regenerateRecoveryKit(session, password));
    } catch (error) {
      message.error(getErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    setCode(null);
    onClose();
  };

  return (
    // Con el kit a la vista no se cierra tocando afuera: se cierra al confirmar que se guardó.
    <Modal open={open} title={t("cloud.account.kitTitle")} onCancel={close} footer={null} mask={{ closable: !code }} closable={!code} destroyOnHidden width={560}>
      {code ? (
        <RecoveryKit code={code} email={session?.user.email ?? ""} onDone={close} />
      ) : (
        <Form layout="vertical" requiredMark={false} onFinish={onFinish} disabled={busy} style={{ marginTop: 16 }}>
          <Typography.Paragraph type="secondary">{t("cloud.account.kitText")}</Typography.Paragraph>
          <Form.Item name="password" label={t("cloud.auth.password")} rules={[{ required: true, message: t("cloud.auth.passwordRequired") }]}>
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy} icon={<KeyRound />}>
            {busy ? t("cloud.auth.working") : t("cloud.account.kitButton")}
          </Button>
        </Form>
      )}
    </Modal>
  );
}
