import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  Input,
  Button,
  Typography,
  Form,
  message,
  Alert,
  Flex,
  LockOutlined,
  UserOutlined,
  MailOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  theme,
} from "@/shared/antd-imports";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import AuthPageHeader from "@/components/AuthPageHeader";
import type { RootState } from "@/store";
import {
  validateInviteToken,
  acceptInvite,
  setError,
} from "@/store/slices/authSlice";

interface InviteFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const InvitePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const {
    isLoading,
    error,
    inviteToken,
    inviteValid,
    inviteChecked,
    inviteLoading,
    inviteDetails,
    isAuthenticated,
  } = useAppSelector((state: RootState) => state.auth);
  const [form] = Form.useForm<InviteFormValues>();
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordActive, setPasswordActive] = useState(false);
  const [isWorklenzUser, setIsWorklenzUser] = useState(false);
  const themeMode = useAppSelector((state: RootState) => state.ui.theme);
  const { token: { colorBgLayout } } = theme.useToken();

  const passwordChecklistItems = [
    {
      key: "minLength",
      test: (v: string) => v.length >= 8,
      label: t("invite.passwordChecklist.minLength", {
        defaultValue: "At least 8 characters",
      }),
    },
    {
      key: "uppercase",
      test: (v: string) => /[A-Z]/.test(v),
      label: t("invite.passwordChecklist.uppercase", {
        defaultValue: "One uppercase letter",
      }),
    },
    {
      key: "lowercase",
      test: (v: string) => /[a-z]/.test(v),
      label: t("invite.passwordChecklist.lowercase", {
        defaultValue: "One lowercase letter",
      }),
    },
    {
      key: "number",
      test: (v: string) => /\d/.test(v),
      label: t("invite.passwordChecklist.number", {
        defaultValue: "One number",
      }),
    },
    {
      key: "special",
      test: (v: string) => /[@$!%*?&#]/.test(v),
      label: t("invite.passwordChecklist.special", {
        defaultValue: "One special character",
      }),
    },
  ];

  const validationRules = {
    name: [
      { required: true, message: t("invite.name_required") },
      { min: 2, message: t("invite.name_min") },
    ],
    email: [
      { required: true, message: t("invite.email_required") },
      { type: "email" as const, message: t("invite.email_invalid") },
    ],
    password: isWorklenzUser
      ? [
          { required: true, message: t("invite.password_required") },
        ]
      : [
          { required: true, message: t("invite.password_required") },
          { min: 8, message: t("invite.password_min") },
          {
            max: 32,
            message: t("invite.password_max", {
              defaultValue: "Password must be at most 32 characters",
            }),
          },
          {
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
            message: t("invite.password_pattern", {
              defaultValue:
                "Password must include uppercase, lowercase, number, and special character",
            }),
          },
        ],
    confirmPassword: isWorklenzUser
      ? [] // No confirm password needed for existing Worklenz users
      : [
          { required: true, message: t("invite.confirm_password_required") },
          ({ getFieldValue }: { getFieldValue: (field: string) => string }) => ({
            validator(_: unknown, value: string) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error(t("invite.password_mismatch")));
            },
          }),
        ],
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, isAuthenticated]);

  // Validate invite token on page load
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      dispatch(validateInviteToken(token));
    }
  }, [searchParams, dispatch]);

  // Handle organization invites - allow sign-up if needed
  // Note: Organization invites can now be used to create new accounts
  // The form will handle both new user creation and existing user login

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(setError(null));
    };
  }, [dispatch]);

  // Autofill form when invitation details are loaded
  useEffect(() => {
    if (inviteDetails) {
      form.setFieldsValue({
        email: inviteDetails.email || "",
        name: inviteDetails.name || "",
      });

      // Set isWorklenzUser flag immediately if user is an existing Worklenz user
      if (inviteDetails.isExistingWorklenzUser) {
        setIsWorklenzUser(true);
      }
    }
  }, [inviteDetails, form]);

  const onFinish = useCallback(
    async (values: InviteFormValues) => {
      if (!inviteToken) {
        message.error(t("invite.invalid_token"));
        return;
      }

      try {
        const result = await dispatch(
          acceptInvite({
            token: inviteToken,
            name: values.name,
            email: values.email,
            password: values.password,
          })
        );

        if (acceptInvite.fulfilled.match(result)) {
          message.success(t("invite.success"));
          navigate("/dashboard", { replace: true });
        } else {
          const errorKey = result.payload as string;

          // Fallback: Check if this is a Worklenz user error (in case backend detection missed it)
          if (errorKey && errorKey.includes("worklenz_account_found")) {
            setIsWorklenzUser(true);
          }

          // Check if the error is an i18n key (starts with "errors.")
          if (errorKey && errorKey.startsWith("errors.")) {
            const errorMessage = t(errorKey);
            // Show error message for longer duration to give user time to read
            message.error(errorMessage, 6);
          } else {
            message.error(errorKey || t("invite.acceptance_error"));
          }
        }
      } catch (error) {
        console.error("Invite acceptance failed:", error);
        message.error(t("invite.acceptance_error"));
      }
    },
    [dispatch, navigate, t, inviteToken]
  );

  const styles = {
    card: {
      width: 500,
      maxWidth: "90vw",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    },
    button: {
      borderRadius: 4,
    },
    link: {
      fontSize: 14,
    },
  };

  if (inviteLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colorBgLayout,
        }}
      >
        <Card style={styles.card}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <Typography.Title level={3}>
              {t("invite.validating")}
            </Typography.Title>
            <Typography.Text>
              {t("invite.validating_description")}
            </Typography.Text>
          </div>
        </Card>
      </div>
    );
  }

  if (inviteChecked && !inviteValid) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colorBgLayout,
        }}
      >
        <Card style={styles.card}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <Typography.Title level={3} style={{ color: "#ff4d4f" }}>
              {t("invite.invalid_title")}
            </Typography.Title>
            <Typography.Text style={{ marginBottom: 24, display: "block" }}>
              {t("invite.invalid_description")}
            </Typography.Text>
            <Button type="primary" size="large" onClick={() => navigate("/auth/login")}>
              {t("invite.back_to_login")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colorBgLayout,
      }}
    >
      <Card
        style={styles.card}
        styles={{ body: { padding: 32 } }}
        variant="outlined"
      >
        <AuthPageHeader description={t("invite.description")} />

        {isWorklenzUser ? (
          <Alert
            message={t("invite.existing_worklenz_user_title", {
              defaultValue: "Existing Worklenz Account Detected",
            })}
            description={t("invite.existing_worklenz_user_description", {
              defaultValue:
                "You already have a Worklenz account with this email. Please use your existing Worklenz password below to link your client portal access.",
            })}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        ) : (
          <Alert
            message={t("invite.welcome_message")}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {error && (
          <Alert
            message={error.startsWith("errors.") ? t(error) : error}
            type="error"
            closable
            onClose={() => dispatch(setError(null))}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="invite"
          layout="vertical"
          autoComplete="off"
          requiredMark="optional"
          onFinish={onFinish}
          style={{ width: "100%" }}
        >
          <Form.Item name="name" rules={validationRules.name}>
            <Input
              prefix={<UserOutlined />}
              placeholder={t("invite.name_placeholder")}
              size="large"
              style={styles.button}
            />
          </Form.Item>

          <Form.Item name="email" rules={validationRules.email}>
            <Input
              prefix={<MailOutlined />}
              placeholder={t("invite.email_placeholder")}
              size="large"
              style={styles.button}
              disabled={!!inviteDetails?.email}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={validationRules.password}
            validateTrigger={["onBlur", "onSubmit"]}
          >
            <div>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={
                  isWorklenzUser
                    ? t("invite.existing_user_password_placeholder", {
                        defaultValue: "Enter your Worklenz password",
                      })
                    : t("invite.password_placeholder")
                }
                size="large"
                style={styles.button}
                value={passwordValue}
                onFocus={() => setPasswordActive(true)}
                onChange={(e) => {
                  setPasswordValue(e.target.value);
                  setPasswordActive(true);
                }}
                onBlur={() => {
                  if (!passwordValue) setPasswordActive(false);
                }}
              />
              {isWorklenzUser ? (
                <Alert
                  message={t("invite.worklenz_user_info", {
                    defaultValue:
                      "You already have a Worklenz account. Please enter your existing Worklenz password to link your client portal access.",
                  })}
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              ) : (
                <Typography.Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    marginBottom: 0,
                    display: "block",
                  }}
                >
                  {t("invite.password_guideline", {
                    defaultValue:
                      "Password must be at least 8 characters, include uppercase and lowercase letters, a number, and a special character.",
                  })}
                </Typography.Text>
              )}
              {passwordActive && !isWorklenzUser && (
                <div style={{ marginTop: 8, marginBottom: 4 }}>
                  {passwordChecklistItems.map((item) => {
                    const passed = item.test(passwordValue);
                    // Only green if passed, otherwise neutral (never red)
                    const color = passed
                      ? themeMode === "dark"
                        ? "#52c41a"
                        : "#389e0d"
                      : themeMode === "dark"
                        ? "#b0b3b8"
                        : "#bfbfbf";
                    return (
                      <Flex
                        key={item.key}
                        align="center"
                        gap={8}
                        style={{ color, fontSize: 13 }}
                      >
                        {passed ? (
                          <CheckCircleTwoTone
                            twoToneColor={
                              themeMode === "dark" ? "#52c41a" : "#52c41a"
                            }
                          />
                        ) : (
                          <CloseCircleTwoTone
                            twoToneColor={
                              themeMode === "dark" ? "#b0b3b8" : "#bfbfbf"
                            }
                          />
                        )}
                        <span>{item.label}</span>
                      </Flex>
                    );
                  })}
                </div>
              )}
            </div>
          </Form.Item>

          {!isWorklenzUser && (
            <Form.Item
              name="confirmPassword"
              rules={validationRules.confirmPassword}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("invite.confirm_password_placeholder")}
                size="large"
                style={styles.button}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={isLoading}
              style={styles.button}
            >
              {isWorklenzUser
                ? t("invite.link_account", {
                    defaultValue: "Link Account & Continue",
                  })
                : t("invite.accept_invite")}
            </Button>
          </Form.Item>

          <Form.Item>
            <Typography.Text
              style={{ ...styles.link, textAlign: "center", display: "block" }}
            >
              {t("invite.already_have_account")}{" "}
              <Link
                to="/auth/login"
                className="ant-typography ant-typography-link blue-link"
              >
                {t("invite.sign_in")}
              </Link>
            </Typography.Text>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InvitePage;
