import { useRef, useState } from 'react';
import { TFunction } from 'i18next';
import {
  Button,
  Divider,
  Flex,
  Form,
  FormInstance,
  Input,
  InputRef,
  Select,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addCategory,
  createProjectCategory,
} from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { colors } from '@/styles/colors';
import { IProjectCategory } from '@/types/project/projectCategory.types';

interface ProjectCategorySectionProps {
  categories: IProjectCategory[];
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const defaultColorCode = '#ee87c5';

const ProjectCategorySection = ({ categories, form, t, disabled }: ProjectCategorySectionProps) => {
  const dispatch = useAppDispatch();

  const [isAddCategoryInputShow, setIsAddCategoryInputShow] = useState(false);
  const [categoryText, setCategoryText] = useState('');
  const [creating, setCreating] = useState(false);
  const categoryInputRef = useRef<InputRef>(null);

  const categoryOptions = categories.map((category, index) => ({
    key: index,
    value: category.id,
    label: category.name,
  }));

  const handleCategoryInputFocus = () => {
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 0);
  };

  const handleShowAddCategoryInput = () => {
    setIsAddCategoryInputShow(true);
    handleCategoryInputFocus();
  };

  const handleAddCategoryInputBlur = (category: string) => {
    setIsAddCategoryInputShow(false);
    if (!category.trim()) return;
    try {
      const existingCategory = categoryOptions.find(
        option => option.label?.toLowerCase() === category.toLowerCase()
      );
      if (existingCategory) {
        form.setFieldValue('category_id', existingCategory.value);
      }
      form.setFieldValue('category_id', undefined);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAddCategoryInputShow(false);
      setCategoryText('');
      return;
    }
  };

  const handleAddCategoryItem = async (category: string) => {
    if (!category.trim()) return;
    try {
      const existingCategory = categoryOptions.find(
        option => option.label?.toLowerCase() === category.toLowerCase()
      );

      if (existingCategory) {
        form.setFieldValue('category_id', existingCategory.value);
        setCategoryText('');
        setIsAddCategoryInputShow(false);
        return;
      }
      setCreating(true);
      const newCategory = {
        name: category,
      };

      const res = await dispatch(createProjectCategory(newCategory)).unwrap();
      if (res.id) {
        form.setFieldValue('category_id', res.id);
        setCategoryText('');
        setIsAddCategoryInputShow(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Form.Item name="category_id" label={t('category')}>
        {!isAddCategoryInputShow ? (
          <Select
            options={categoryOptions}
            placeholder={t('addCategory')}
            loading={creating}
            allowClear
            dropdownRender={menu => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Button
                  style={{ width: '100%' }}
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleShowAddCategoryInput}
                >
                  {t('newCategory')}
                </Button>
              </>
            )}
            disabled={disabled}
          />
        ) : (
          <Flex vertical gap={4}>
            <Input
              ref={categoryInputRef}
              placeholder={t('enterCategoryName')}
              value={categoryText}
              onChange={e => setCategoryText(e.currentTarget.value)}
              allowClear
              onClear={() => {
                setIsAddCategoryInputShow(false);
              }}
              onPressEnter={() => handleAddCategoryItem(categoryText)}
              onBlur={() => handleAddCategoryInputBlur(categoryText)}
              disabled={disabled}
            />
            <Typography.Text style={{ color: colors.lightGray }}>
              {t('hitEnterToCreate')}
            </Typography.Text>
          </Flex>
        )}
      </Form.Item>
    </>
  );
};

export default ProjectCategorySection;
