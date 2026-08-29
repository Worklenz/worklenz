import { QuestionCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { Button, Flex, Form, Input, Select, Typography, theme } from '@/shared/antd-imports';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TempRequestFromItemType,
  TempServicesType,
} from '@/ee/types/client-portal/temp-client-portal.types';

type RequestFormStepProps = {
  setCurrent: (index: number) => void;
  service: TempServicesType;
  setService: (service: TempServicesType) => void;
};

const RequestFormStep = ({ setCurrent, service, setService }: RequestFormStepProps) => {
  const [isAddQuestionCardVisible, setIsAddQuestionCardVisible] = useState(false);

  const addQuestionCardRef = useRef<HTMLDivElement>(null);

  const [requestForm, setRequestForm] = useState<TempRequestFromItemType[]>(
    service.service_data?.request_form || []
  );

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [originalQuestion, setOriginalQuestion] = useState<TempRequestFromItemType | null>(null);

  const { token } = theme.useToken();

  const sampleQuestions: TempRequestFromItemType[] = [
    {
      question: 'What is the project scope and timeline?',
      type: 'text',
      answer: [],
    },
    {
      question: 'What is your budget range?',
      type: 'multipleChoice',
      answer: ['$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000+'],
    },
    {
      question: 'Please upload any relevant documents or examples',
      type: 'attachment',
      answer: [],
    },
    {
      question: 'How did you hear about our services?',
      type: 'multipleChoice',
      answer: ['Google Search', 'Social Media', 'Referral', 'Website', 'Other'],
    },
  ];

  const questionTypeExamples = {
    text: {
      icon: '📝',
      description: 'Open-ended questions for detailed responses',
      examples: [
        'What are your project goals?',
        'Describe your target audience',
        'What challenges are you facing?',
      ],
    },
    multipleChoice: {
      icon: '☑️',
      description: 'Predefined options for quick selection',
      examples: ['Budget range', 'Timeline preferences', 'Service type needed'],
    },
    attachment: {
      icon: '📎',
      description: 'File uploads for documents, images, etc.',
      examples: ['Upload your logo', 'Share reference materials', 'Provide existing documents'],
    },
  };

  const handleAddSampleQuestions = () => {
    setRequestForm(sampleQuestions);
  };

  const [newQuestion, setNewQuestion] = useState<{
    question: string;
    type: 'text' | 'multipleChoice' | 'attachment';
    options: string[];
  }>({
    question: '',
    type: 'text',
    options: [],
  });

  const { t } = useTranslation('client-portal-services');

  const handleAddQuestion = () => {
    const newQuestionData: TempRequestFromItemType = {
      question: newQuestion.question,
      type: newQuestion.type,
      answer: newQuestion.type === 'multipleChoice' ? newQuestion.options : [],
    };

    if (editingIndex !== null) {
      setRequestForm(prev => {
        const updated = [...prev];
        updated.splice(editingIndex, 0, newQuestionData);
        return updated;
      });
    } else {
      setRequestForm(prev => [...prev, newQuestionData]);
    }

    setNewQuestion({
      question: '',
      type: 'text',
      options: [],
    });
    setEditingIndex(null);
    setOriginalQuestion(null);

    setIsAddQuestionCardVisible(false);
  };

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

  const handleDeleteQuestion = (index: number) => {
    setRequestForm(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditQuestion = (index: number) => {
    const questionToEdit = requestForm[index];
    setOriginalQuestion(questionToEdit);
    setEditingIndex(index);
    setNewQuestion({
      question: questionToEdit.question,
      type: questionToEdit.type,
      options: questionToEdit.type === 'multipleChoice' ? (questionToEdit.answer as string[]) : [],
    });
    handleDeleteQuestion(index);
    setIsAddQuestionCardVisible(true);
  };

  const handleCancelEdit = () => {
    if (editingIndex !== null && originalQuestion) {
      setRequestForm(prev => {
        const updated = [...prev];
        updated.splice(editingIndex, 0, originalQuestion);
        return updated;
      });
    }

    setNewQuestion({
      question: '',
      type: 'text',
      options: [],
    });
    setEditingIndex(null);
    setOriginalQuestion(null);
    setIsAddQuestionCardVisible(false);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {requestForm.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {t('questionsCountText', { count: requestForm.length, defaultValue: '{{count}} question(s)' })}
          </Typography.Text>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <Flex vertical gap={12}>
          {requestForm.length === 0 && !isAddQuestionCardVisible && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <QuestionCircleOutlined
                style={{ fontSize: 48, color: token.colorPrimary, marginBottom: 16 }}
              />
               <Typography.Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                 {t('addQuestionsTitle', { defaultValue: 'Add Questions' })}
               </Typography.Title>
               <Typography.Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
                 {t('addQuestionsSubtitle', { defaultValue: 'Create custom questions for your clients to answer.' })}
              </Typography.Text>

              <Flex gap={16} justify="center" wrap>
                <Button
                  type="primary"
                  icon={<BulbOutlined />}
                  onClick={handleAddSampleQuestions}
                  size="large"
                  style={{ minWidth: 180 }}
                >
                  {t('useSampleQuestionsButton', { defaultValue: 'Use Sample Questions' })}
                </Button>
                <Button
                  onClick={() => setIsAddQuestionCardVisible(true)}
                  size="large"
                  style={{ minWidth: 160 }}
                >
                  {t('addCustomQuestionButton', { defaultValue: 'Add Custom Question' })}
                </Button>
              </Flex>
            </div>
          )}

          {requestForm.length > 0 && (
            <div>
              {requestForm.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: token.colorFillAlter,
                    borderRadius: 8,
                    border: `1px solid ${token.colorBorder}`,
                  }}
                >
                  <Flex justify="space-between" align="flex-start">
                    <div style={{ flex: 1 }}>
                      <Typography.Text
                        style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}
                      >
                         {t('questionNumberText', { number: index + 1, question: item.question, defaultValue: 'Question {{number}}' })}
                      </Typography.Text>
                      <Flex align="center" gap={8}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {item.type === 'multipleChoice'
                            ? t('multipleChoiceLabel', { defaultValue: 'Multiple Choice' })
                            : item.type === 'attachment'
                              ? t('fileUploadLabel', { defaultValue: 'File Upload' })
                              : t('textAnswerLabel', { defaultValue: 'Text Answer' })}
                        </Typography.Text>
                        {item.type === 'multipleChoice' &&
                          item.answer &&
                          Array.isArray(item.answer) && (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {t('optionsCountText', { count: item.answer.length, defaultValue: '{{count}} option(s)' })}
                            </Typography.Text>
                          )}
                      </Flex>
                    </div>
                    <Flex gap={8}>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => handleEditQuestion(index)}
                        style={{ padding: '0 8px' }}
                      >
                         {t('editButton', { defaultValue: 'Edit' })}
                      </Button>
                      <Button
                        type="text"
                        size="small"
                        onClick={() => handleDeleteQuestion(index)}
                        style={{ color: token.colorError, padding: '0 8px' }}
                      >
                        ×
                      </Button>
                    </Flex>
                  </Flex>
                </div>
              ))}

              {!isAddQuestionCardVisible && (
                <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16 }}>
                  <Button
                    type="dashed"
                    size="large"
                    onClick={() => setIsAddQuestionCardVisible(true)}
                    style={{
                      borderColor: token.colorPrimary,
                      color: token.colorPrimary,
                      borderWidth: 2,
                      height: 48,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                     {t('addAnotherQuestionButton', { defaultValue: '+ Add Another Question' })}
                  </Button>
                </div>
              )}
            </div>
          )}

          {isAddQuestionCardVisible && (
            <div
              style={{
                padding: 16,
                backgroundColor: token.colorFillAlter,
                borderRadius: 8,
                border: `2px solid ${token.colorPrimary}`,
              }}
              ref={addQuestionCardRef}
            >
              <Form layout="vertical" onFinish={handleAddQuestion}>
                 <Form.Item label={t('questionFormLabel', { defaultValue: 'Question' })} style={{ marginBottom: 16 }}>
                   <Input.TextArea
                     autoFocus
                     required
                     placeholder={t('questionPlaceholder', { defaultValue: 'Enter your question...' })}
                    value={newQuestion.question}
                    onChange={e =>
                      setNewQuestion({
                        ...newQuestion,
                        question: e.target.value,
                      })
                    }
                    rows={2}
                  />
                </Form.Item>

                 <Form.Item label={t('answerTypeLabel', { defaultValue: 'Answer Type' })} style={{ marginBottom: 16 }}>
                  <Select
                    value={newQuestion.type}
                    onChange={value => {
                      setNewQuestion({
                        ...newQuestion,
                        type: value,
                        options: value === 'multipleChoice' ? ['', ''] : [],
                      });
                    }}
                     options={[
                       { label: t('textAnswerOption', { defaultValue: 'Text Answer' }), value: 'text' },
                       { label: t('multipleChoiceOption', { defaultValue: 'Multiple Choice' }), value: 'multipleChoice' },
                       { label: t('fileUploadOption', { defaultValue: 'File Upload' }), value: 'attachment' },
                     ]}
                  />
                </Form.Item>

                 {newQuestion.type === 'multipleChoice' && (
                   <Form.Item label={t('optionsLabel', { defaultValue: 'Options' })} style={{ marginBottom: 16 }}>
                    <Flex vertical gap={8}>
                      {newQuestion.options.map((option, index) => (
                        <Flex key={index} gap={8} align="center">
                          <Input
                             placeholder={t('optionPlaceholder', { n: index + 1, defaultValue: 'Option {{n}}' })}
                            value={option}
                            onChange={e => {
                              const updatedOptions = [...newQuestion.options];
                              updatedOptions[index] = e.target.value;
                              setNewQuestion({
                                ...newQuestion,
                                options: updatedOptions,
                              });
                            }}
                          />
                          {newQuestion.options.length > 1 && (
                            <Button
                              type="text"
                              size="small"
                              onClick={() => {
                                const updatedOptions = newQuestion.options.filter(
                                  (_, i) => i !== index
                                );
                                setNewQuestion({
                                  ...newQuestion,
                                  options: updatedOptions,
                                });
                              }}
                              style={{ color: token.colorError }}
                            >
                              ×
                            </Button>
                          )}
                        </Flex>
                      ))}

                      <Button
                        type="dashed"
                        size="small"
                        onClick={() => {
                          setNewQuestion({
                            ...newQuestion,
                            options: [...newQuestion.options, ''],
                          });
                        }}
                        style={{ width: 'fit-content' }}
                      >
                         {t('addOptionButton', { defaultValue: '+ Add Option' })}
                      </Button>
                    </Flex>
                  </Form.Item>
                )}

                <Flex gap={12} justify="flex-end">
                   <Button onClick={handleCancelEdit} size="large">
                     {t('cancelButton', { defaultValue: 'Cancel' })}
                   </Button>
                   <Button type="primary" htmlType="submit" size="large">
                     {editingIndex !== null ? t('updateQuestionButton', { defaultValue: 'Update Question' }) : t('addQuestionButton', { defaultValue: 'Add Question' })}
                  </Button>
                </Flex>
              </Form>
            </div>
          )}
        </Flex>
      </div>

      <div style={{ borderTop: `1px solid ${token.colorBorder}`, paddingTop: 16, flexShrink: 0 }}>
        <Flex align="center" justify="flex-end">
          <Flex gap={12}>
             <Button onClick={() => setCurrent(0)} size="large">
               {t('previousButton', { defaultValue: 'Previous' })}
             </Button>
             <Button type="primary" onClick={handleNext} size="large">
               {t('continueButton', { defaultValue: 'Continue' })}
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
};

export default RequestFormStep;
