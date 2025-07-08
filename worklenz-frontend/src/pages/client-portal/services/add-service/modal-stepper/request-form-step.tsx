import { AppstoreOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Form, Input, Select, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TempRequestFromItemType,
  TempServicesType,
} from '../../../../../types/client-portal/temp-client-portal.types';
import { colors } from '../../../../../styles/colors';

type RequestFormStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
  setService: (service: TempServicesType) => void;
};

const RequestFormStep = ({
  setCurrent,
  service,
  setService,
}: RequestFormStepProps) => {
  const [isAddQuestionCardVisible, setIsAddQuestionCardVisible] =
    useState(false);

  const addQuestionCardRef = useRef<HTMLDivElement>(null);

  const [requestForm, setRequestForm] = useState<TempRequestFromItemType[]>([
    {
      question: "If you're ordering for a business, what's your industry?",
      type: 'multipleChoice',
      answer: ['3D design', 'e-commerce', 'accounting', 'marketing', 'etc.'],
    },
    {
      question: "If you're ordering for a business, what's your industry?",
      type: 'text',
      answer: ['3D design', 'e-commerce', 'accounting', 'marketing', 'etc.'],
    },
  ]);

  // States for new question form
  const [newQuestion, setNewQuestion] = useState<{
    question: string;
    type: 'text' | 'multipleChoice' | 'attachment';
    options: string[];
  }>({
    question: '',
    type: 'text', // Default to 'text' question type
    options: [], // Empty options array for multipleChoice type
  });

  // Localization
  const { t } = useTranslation('client-portal-services');

  const handleAddQuestion = () => {
    // Ensure that when a new question is added, it conforms to the TempRequestFromItemType shape
    const newQuestionData: TempRequestFromItemType = {
      question: newQuestion.question,
      type: newQuestion.type,
      answer: newQuestion.type === 'multipleChoice' ? newQuestion.options : [],
    };

    // Update the state with the new question
    setRequestForm((prev) => [...prev, newQuestionData]);

    // Clear the new question form
    setNewQuestion({
      question: '',
      type: 'text',
      options: [],
    });

    // Hide the Add Question form card
    setIsAddQuestionCardVisible(false);
  };

  // function to handle next
  const handleNext = () => {
    setService({
      ...service,
      service_data: {
        ...service.service_data,
        request_form: requestForm,
      },
    });
    setCurrent(2);
  };

  return (
    <Flex vertical gap={12}>
      <Flex
        vertical
        gap={24}
        style={{ height: 'calc(100vh - 460px)', overflowY: 'auto' }}
      >
        <Flex vertical gap={12}>
          {requestForm.map((item, index) => (
            <Card key={index}>
              <Flex vertical gap={8}>
                <Flex gap={8}>
                  <AppstoreOutlined />
                  <Typography.Text>{t(`${item.type}Option`)}</Typography.Text>
                </Flex>
                <Flex vertical gap={4} style={{ marginInlineStart: 22 }}>
                  <Typography.Text style={{ fontSize: 16, fontWeight: 600 }}>
                    {item.question}
                  </Typography.Text>
                  {item.type === 'multipleChoice' && (
                    <div>
                      {Array.isArray(item.answer) &&
                        item.answer.map((answer: any, index: any) => (
                          <Typography.Text key={index}>
                            {answer}
                            {item.answer &&
                              index < item.answer.length - 1 &&
                              ', '}
                          </Typography.Text>
                        ))}
                    </div>
                  )}
                </Flex>
                <Flex gap={4} style={{ alignSelf: 'flex-end' }}>
                  <Button type="link">{t('editButton')}</Button>
                  <Button type="link">{t('deleteButton')}</Button>
                </Flex>
              </Flex>
            </Card>
          ))}

          {isAddQuestionCardVisible && (
            <Card
              style={{ borderColor: colors.skyBlue }}
              ref={addQuestionCardRef}
            >
              <Form layout="vertical" onFinish={handleAddQuestion}>
                <Form.Item label={t('questionLabel')}>
                  <Input.TextArea
                    autoFocus
                    required
                    placeholder={t('questionPlaceholder')}
                    value={newQuestion.question}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        question: e.target.value,
                      })
                    }
                  />
                </Form.Item>
                <Form.Item label={t('questionTypeLabel')}>
                  <Select
                    style={{ maxWidth: 280 }}
                    value={newQuestion.type}
                    onChange={(value) =>
                      setNewQuestion({ ...newQuestion, type: value })
                    }
                    options={[
                      {
                        label: t('textOption'),
                        value: 'text',
                      },
                      {
                        label: t('multipleChoiceOption'),
                        value: 'multipleChoice',
                      },
                      {
                        label: t('attachmentOption'),
                        value: 'attachment',
                      },
                    ]}
                  />
                </Form.Item>

                {/* Render the options input if it's a multipleChoice type */}
                {newQuestion.type === 'multipleChoice' && (
                  <Form.Item>
                    <Flex vertical gap={8}>
                      <Flex vertical gap={4}>
                        {newQuestion.options.map((option, index) => (
                          <div>
                            <Input
                              style={{ maxWidth: 300 }}
                              value={option}
                              onChange={(e) => {
                                const updatedOptions = [...newQuestion.options];
                                updatedOptions[index] = e.target.value;
                                setNewQuestion({
                                  ...newQuestion,
                                  options: updatedOptions,
                                });
                              }}
                            />
                            {index > 0 && (
                              <Button
                                type="link"
                                icon={<CloseCircleOutlined />}
                                onClick={() => {
                                  const updatedOptions =
                                    newQuestion.options.filter(
                                      (_, i) => i !== index
                                    );
                                  setNewQuestion({
                                    ...newQuestion,
                                    options: updatedOptions,
                                  });
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </Flex>

                      <Button
                        type="link"
                        style={{ width: 'fit-content', padding: 0 }}
                        onClick={() => {
                          setNewQuestion({
                            ...newQuestion,
                            options: [...newQuestion.options, ''],
                          });
                        }}
                      >
                        {t('addOptionButton')}
                      </Button>
                    </Flex>
                  </Form.Item>
                )}

                <Form.Item>
                  <Flex gap={8} justify="flex-end">
                    <Button
                      type="default"
                      onClick={() => setIsAddQuestionCardVisible(false)}
                    >
                      {t('cancelButton')}
                    </Button>

                    <Button type="primary" htmlType="submit">
                      {t('saveButton')}
                    </Button>
                  </Flex>
                </Form.Item>
              </Form>
            </Card>
          )}
        </Flex>
      </Flex>

      <Flex align="center" justify="space-between">
        <Button
          type="dashed"
          style={{
            width: 'fit-content',
            color: colors.skyBlue,
            borderColor: colors.skyBlue,
          }}
          onClick={() => {
            setIsAddQuestionCardVisible(true);
            setTimeout(() => {
              addQuestionCardRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
              });
            }, 0);
          }}
        >
          {t('addQuestionButton')}
        </Button>

        <Flex gap={8}>
          <Button onClick={() => setCurrent(0)}>{t('previousButton')}</Button>
          <Button type="primary" onClick={handleNext}>
            {t('nextButton')}
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default RequestFormStep;
