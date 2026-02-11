import React, { useCallback, useState, useEffect } from "react";
import {
  Card,
  Input,
  Button,
  Typography,
  Form,
  Flex,
  LockOutlined,
  Result,
  message,
} from "@/shared/antd-imports";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/hooks/useAppSelector";
import AuthPageHeader from "@/components/AuthPageHeader";
import clientPortalAPI from "@/services/api";

interface ResetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<ResetPasswordFormValues>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  const user = searchParams.get("user");
  const hash = searchParams.get("hash");

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, isAuthenticated]);

  // Validate that user and hash are present
  useEffect(() => {
    if (!user || !hash) {
      message.error(
        t("resetPassword.invalidLink", {
          defaultValue: "Invalid reset link. Please request a new password reset.",
        })
      );
      navigate("/auth/forgot-password", { replace: true });
    }
  }, [user, hash, navigate, t]);

  const onFinish = useCallback(
    async (values: ResetPasswordFormValues) => {
      if (!user || !hash) return;

      try {
        setIsLoading(true);
        const result = await clientPortalAPI.resetPassword({
          user,
          hash,
          password: values.password,
        });

        if (result.done) {
          setIsSuccess(true);
        } else {
          const errorMessage =
            result.message ||
            t("resetPassword.errorMessage", {
              defaultValue: "Failed to reset password. Please try again.",
            });
          message.error(errorMessage);
        }
      } catch (error: any) {
        console.error("Failed to reset password", error);
        const errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          t("resetPassword.errorMessage", {
            defaultValue: "Failed to reset password. Please try again.",
          });
        message.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [user, hash, t]
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
        background: "#f0f2f5",
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
            title={t("resetPassword.successTitle", {
              defaultValue: "Password Reset Successful",
            })}
            subTitle={t("resetPassword.successMessage", {
              defaultValue:
                "Your password has been successfully reset. You can now log in with your new password.",
            })}
            extra={[
              <Button
                key="login"
                type="primary"
                size="large"
                style={styles.button}
                onClick={() => navigate("/auth/login")}
              >
                {t("resetPassword.goToLogin", {
                  defaultValue: "Go to Login",
                })}
              </Button>,
            ]}
          />
        ) : (
          <>
            <AuthPageHeader
              description={t("resetPassword.description", {
                defaultValue: "Enter your new password",
              })}
            />

            <Form
              form={form}
              name="reset-password"
              layout="vertical"
              autoComplete="off"
              requiredMark="optional"
              onFinish={onFinish}
              style={{ width: "100%" }}
            >
              <Form.Item
                name="password"
                rules={[
                  {
                    required: true,
                    message: t("resetPassword.passwordRequired", {
                      defaultValue: "Please enter your new password",
                    }),
                  },
                  {
                    min: 6,
                    message: t("resetPassword.passwordMinLength", {
                      defaultValue: "Password must be at least 6 characters",
                    }),
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t("resetPassword.passwordPlaceholder", {
                    defaultValue: "Enter new password",
                  })}
                  size="large"
                  style={styles.button}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={["password"]}
                rules={[
                  {
                    required: true,
                    message: t("resetPassword.confirmPasswordRequired", {
                      defaultValue: "Please confirm your new password",
                    }),
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(
                          t("resetPassword.passwordMismatch", {
                            defaultValue: "Passwords do not match",
                          })
                        )
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t("resetPassword.confirmPasswordPlaceholder", {
                    defaultValue: "Confirm new password",
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
                    {t("resetPassword.resetPasswordButton", {
                      defaultValue: "Reset Password",
                    })}
                  </Button>
                  <Typography.Text style={{ textAlign: "center" }}>
                    {t("resetPassword.orText", { defaultValue: "or" })}
                  </Typography.Text>
                  <Button
                    block
                    type="default"
                    size="large"
                    style={styles.button}
                    onClick={() => navigate("/auth/login")}
                  >
                    {t("resetPassword.backToLogin", {
                      defaultValue: "Back to Login",
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

export default ResetPasswordPage;
