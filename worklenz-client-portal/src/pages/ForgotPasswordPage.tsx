import React, { useCallback, useState } from "react";
import {
  Card,
  Input,
  Button,
  Typography,
  Form,
  Flex,
  UserOutlined,
  Result,
  theme,
} from "@/shared/antd-imports";
import { App } from "antd";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/hooks/useAppSelector";
import AuthPageHeader from "@/components/AuthPageHeader";
import clientPortalAPI from "@/services/api";

interface ForgotPasswordFormValues {
  email: string;
}

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notification } = App.useApp();
  const { token: { colorBgLayout } } = theme.useToken();
  const [form] = Form.useForm<ForgotPasswordFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // Redirect authenticated users to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, isAuthenticated]);

  const onFinish = useCallback(
    async (values: ForgotPasswordFormValues) => {
      if (values.email.trim() === "") return;
      try {
        setIsLoading(true);
        // Normalize email to lowercase for case-insensitive comparison
        const normalizedEmail = values.email.toLowerCase().trim();
        const result = await clientPortalAPI.requestPasswordReset(normalizedEmail);
        if (result.done) {
          setIsSuccess(true);
        } else {
          // Backend returned done: false with an error message
          const errorMessage =
            result.message ||
            t("forgotPassword.errorMessage", {
              defaultValue: "Failed to send password reset email. Please try again.",
            });
          notification.error({
            message: t("forgotPassword.errorTitle", { defaultValue: "Error" }),
            description: errorMessage,
            placement: "topRight",
          });
        }
      } catch (error: any) {
        console.error("Failed to request password reset", error);
        // For HTTP errors, axios puts the server response body at error.response.data
        // The backend ServerResponse shape is { done, body, message }
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t("forgotPassword.errorMessage", {
            defaultValue: "Failed to send password reset email. Please try again.",
          });
        notification.error({
          message: t("forgotPassword.errorTitle", { defaultValue: "Error" }),
          description: errorMessage,
          placement: "topRight",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [t]
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
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colorBgLayout,
        padding: 24,
      }}
    >
      <Card
        style={styles.card}
        styles={{ body: { padding: 32 } }}
        variant="outlined"
      >
        {isSuccess ? (
          <Result
            status="success"
            title={t("forgotPassword.successTitle", {
              defaultValue: "Password Reset Email Sent",
            })}
            subTitle={t("forgotPassword.successMessage", {
              defaultValue:
                "If an account exists with this email, you will receive password reset instructions shortly.",
            })}
            extra={[
              <Button 
                key="login" 
                type="primary" 
                size="large" 
                style={styles.button}
                onClick={() => navigate("/auth/login")}
              >
                {t("forgotPassword.backToLogin", {
                  defaultValue: "Back to Login",
                })}
              </Button>,
            ]}
          />
        ) : (
          <>
            <AuthPageHeader
              description={t("forgotPassword.description", {
                defaultValue: "Enter your email to reset your password",
              })}
            />

            <Form
              form={form}
              name="forgot-password"
              layout="vertical"
              autoComplete="off"
              requiredMark="optional"
              onFinish={onFinish}
              style={{ width: "100%" }}
            >
              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    type: "email",
                    message: t("forgotPassword.emailRequired", {
                      defaultValue: "Please enter a valid email address",
                    }),
                  },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder={t("forgotPassword.emailPlaceholder", {
                    defaultValue: "Enter your email",
                  })}
                  size="large"
                  style={styles.button}
                />
              </Form.Item>

              <Form.Item>
                <Flex vertical gap={8}>
                  <Button
                    block
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={isLoading}
                    style={styles.button}
                  >
                    {t("forgotPassword.resetPasswordButton", {
                      defaultValue: "Reset Password",
                    })}
                  </Button>
                  <Typography.Text style={{ textAlign: "center" }}>
                    {t("forgotPassword.orText", { defaultValue: "or" })}
                  </Typography.Text>
                  <Button
                    block
                    type="default"
                    size="large"
                    style={styles.button}
                    onClick={() => navigate("/auth/login")}
                  >
                    {t("forgotPassword.returnToLoginButton", {
                      defaultValue: "Return to Login",
                    })}
                  </Button>
                </Flex>
              </Form.Item>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;

