import { Alert, Button, Card, Divider, Flex, Form, Input, Typography, theme } from "antd";
import { browserSupportsWebAuthn, startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProviderButton } from "../src/components/ui/ProviderButton";
import { PlatformAdminPage } from "./Panel";
import { api, CloudError, OperatorLayout, useT } from "./support";

export function OperatorApp() {
  const t = useT();
  const { token } = theme.useToken();
  const pending = useRef(false);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [form] = Form.useForm<{ key: string; code: string }>();
  const [recoverForm] = Form.useForm<{ code: string }>();
  useEffect(() => {
    let cancelled = false;
    const urlCode = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code")?.trim() : null;
    if (urlCode && /^\d{6}$/.test(urlCode)) {
      window.history.replaceState(null, "", window.location.pathname);
      api("POST", "/api/admin/auth/recover/verify", { code: urlCode })
        .then(() => { if (!cancelled) setAuthenticated(true); })
        .catch((err: unknown) => {
          if (!cancelled) {
            setRecoverOpen(true);
            setError(err instanceof CloudError && err.status === 429 ? t("operator.tooMany") : t("operator.recoverInvalid"));
          }
        })
        .finally(() => { if (!cancelled) setReady(true); });
      return () => { cancelled = true; };
    }
    api("GET", "/api/admin/auth/session").then(() => { if (!cancelled) setAuthenticated(true); })
      .catch((err: unknown) => { if (!cancelled && err instanceof CloudError && err.status === 404) setError(t("operator.notConfigured")); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [t]);
  function loginError(err: unknown) {
    const status = err instanceof CloudError ? err.status : 0;
    if (status === 401) return t("operator.invalid");
    if (status === 429) return t("operator.tooMany");
    if (status === 403) return t("operator.wrongOrigin");
    if (status === 404) return t("operator.notConfigured");
    if (status === 502 || status === 503) return t("operator.recoverMailUnavailable");
    return t("operator.error");
  }
  /** Con una llave del dispositivo: huella, cara o PIN. */
  async function passkeyLogin() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>("POST", "/api/admin/auth/passkey/login/options", {});
      let response;
      try { response = await startAuthentication({ optionsJSON }); }
      catch { setError(t("operator.passkeyCancelled")); return; }
      await api("POST", "/api/admin/auth/passkey/login", { response });
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof CloudError && err.status === 401 ? t("operator.passkeyFailed") : loginError(err));
    } finally { pending.current = false; setBusy(false); }
  }
  async function login(values: { key: string; code: string }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("POST", "/api/admin/auth/login", values);
      form.resetFields(); setAuthenticated(true);
    } catch (err) {
      form.setFieldValue("code", "");
      setError(loginError(err));
    } finally { pending.current = false; setBusy(false); }
  }
  async function sendRecoveryEmail() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("POST", "/api/admin/auth/recover", {});
      setRecoverOpen(true);
      setRecoverSent(true);
    } catch (err) {
      setError(loginError(err));
    } finally { pending.current = false; setBusy(false); }
  }
  async function verifyRecoveryCode(values: { code: string }) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("POST", "/api/admin/auth/recover/verify", values);
      recoverForm.resetFields();
      setAuthenticated(true);
    } catch (err) {
      recoverForm.setFieldValue("code", "");
      setError(err instanceof CloudError && err.status === 401 ? t("operator.recoverInvalid") : loginError(err));
    } finally { pending.current = false; setBusy(false); }
  }
  if (!ready) return <OperatorLayout authenticated={false}><Typography.Text role="status">{t("operator.checking")}</Typography.Text></OperatorLayout>;
  if (authenticated) return <PlatformAdminPage />;
  return <OperatorLayout width={520} authenticated={false}>
    <Card>
      <Typography.Title level={1} style={{ fontSize: token.fontSizeHeading3, marginTop: 0 }}>{t("operator.title")}</Typography.Title>
      <Typography.Paragraph type="secondary">{t("operator.intro")}</Typography.Paragraph>
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: token.margin }} />}
      {recoverSent && <Alert type="success" title={t("operator.recoverSent")} showIcon style={{ marginBottom: token.margin }} />}
      {browserSupportsWebAuthn() && <>
        <ProviderButton provider="passkey" loading={busy} disabled={busy} onClick={() => void passkeyLogin()}>{t("operator.passkeyLogin")}</ProviderButton>
        <Divider plain>{t("operator.passkeyOr")}</Divider>
      </>}
      <Form form={form} layout="vertical" requiredMark={false} disabled={busy} onFinish={login}>
        <Form.Item name="key" label={t("operator.key")} normalize={(value: string) => value.replace(/\s/g, "").toLowerCase()} rules={[{ required: true, message: t("operator.keyRequired") }]}><Input.Password autoComplete="current-password" style={{ minHeight: 44 }} /></Form.Item>
        <Form.Item name="code" label={t("operator.code")} normalize={(value: string) => value.replace(/\D/g, "").slice(0, 6)} rules={[{ required: true, pattern: /^\d{6}$/, message: t("operator.codeRequired") }]}><Input inputMode="numeric" autoComplete="one-time-code" style={{ minHeight: 44 }} /></Form.Item>
        <Button aria-label={t("operator.login")} type="primary" htmlType="submit" loading={busy} block style={{ minHeight: 44 }}>{t("operator.login")}</Button>
      </Form>
      <Divider plain>{t("operator.recoverOr")}</Divider>
      <Flex vertical gap={token.marginSM}>
        <Button icon={<Mail />} loading={busy} disabled={busy} onClick={() => void sendRecoveryEmail()} block style={{ minHeight: 44 }}>
          {t(recoverSent ? "operator.recoverResend" : "operator.recoverSend")}
        </Button>
        {!recoverOpen && (
          <Button type="text" disabled={busy} onClick={() => setRecoverOpen(true)} block style={{ minHeight: 44 }}>
            {t("operator.recoverHaveCode")}
          </Button>
        )}
        {recoverOpen && (
          <Form form={recoverForm} layout="vertical" requiredMark={false} disabled={busy} onFinish={verifyRecoveryCode}>
            <Form.Item name="code" label={t("operator.recoverCode")} normalize={(value: string) => value.replace(/\D/g, "").slice(0, 6)} rules={[{ required: true, pattern: /^\d{6}$/, message: t("operator.codeRequired") }]}>
              <Input inputMode="numeric" autoComplete="one-time-code" style={{ minHeight: 44 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy} block style={{ minHeight: 44 }}>
              {t("operator.recoverSubmit")}
            </Button>
          </Form>
        )}
      </Flex>
    </Card>
  </OperatorLayout>;
}
