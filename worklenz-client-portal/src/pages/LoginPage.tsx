import React, { useCallback, useEffect } from "react";
import {
  Card,
  Input,
  Flex,
  Checkbox,
  Button,
  Typography,
  Form,
  message,
  Alert,
  LockOutlined,
  UserOutlined,
  theme,
} from "@/shared/antd-imports";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import AuthPageHeader from "@/components/AuthPageHeader";
import { loginUser, setError } from "@/store/slices/authSlice";
import type { RootState } from "@/store";

interface LoginFormValues {
  email: string;
  password: string;
  remember?: boolean;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token: { colorBgLayout } } = theme.useToken();
  const { isLoading, error, isAuthenticated } = useAppSelector(
    (state: RootState) => state.auth
  );
  const [form] = Form.useForm<LoginFormValues>();

  const validationRules = {
    email: [
      { required: true, message: t("login.emailRequired") },
      { type: "email" as const, message: t("login.emailInvalid") },
    ],
    password: [
      { required: true, message: t("login.passwordRequired") },
      { min: 8, message: t("login.passwordMin") },
    ],
  };

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, isAuthenticated]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(setError(null));
    };
  }, [dispatch]);

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      try {
        const result = await dispatch(
          loginUser({
            email: values.email,
            password: values.password,
          })
        );

        if (loginUser.fulfilled.match(result)) {
          message.success(t("login.success"));
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error("Login failed", error);
        message.error(t("login.failed"));
      }
    },
    [dispatch, navigate, t]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colorBgLayout,
        padding: 24,
      }}
    >
      <Card
        style={{ width: 400, maxWidth: "100%" }}
        styles={{ body: { padding: 32 } }}
      >
        <AuthPageHeader description={t("login.description")} />

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => dispatch(setError(null))}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="login"
          layout="vertical"
          autoComplete="off"
          requiredMark={false}
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item 
            name="email" 
            rules={validationRules.email}
            label={t("login.emailLabel", "Email")}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t("login.email")}
            />
          </Form.Item>

          <Form.Item 
            name="password" 
            rules={validationRules.password}
            label={t("login.passwordLabel", "Password")}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t("login.password")}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Flex justify="space-between" align="center">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>{t("login.remember")}</Checkbox>
              </Form.Item>
              <Link to="/auth/forgot-password" className="ant-typography ant-typography-link">
                {t("login.forgot")}
              </Link>
            </Flex>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              block
              type="primary"
              htmlType="submit"
              loading={isLoading}
            >
              {t("login.signin")}
            </Button>
          </Form.Item>

          <div style={{ textAlign: "center" }}>
            <Typography.Text type="secondary">
              {t("login.invite_only")}
            </Typography.Text>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
