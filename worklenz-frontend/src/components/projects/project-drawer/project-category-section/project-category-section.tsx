import { useRef, useState, useEffect } from 'react';
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
  Tooltip,
} from '@/shared/antd-imports';
import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  createProjectCategory,
  fetchProjectCategories,
} from '@/features/projects/lookups/projectCategories/projectCategoriesSlice';
import { colors } from '@/styles/colors';
import { useAuthService } from '@/hooks/useAuth';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import { useTranslation } from 'react-i18next';
import { safeTextDisplay } from '@/utils/html-entities';

interface ProjectCategorySectionProps {
  form: FormInstance;
  t: TFunction;
  disabled: boolean;
}

const ProjectCategorySection = ({ form, t, disabled }: ProjectCategorySectionProps) => {
  const dispatch = useAppDispatch();
  const { t: tCommon } = useTranslation('common');
  const { isFreeUser: isFree } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();

  // Read categories directly from Redux - this will auto-update when categories change
  const categories = useAppSelector(state => state.projectCategoriesReducer.projectCategories);

  const [isAddCategoryInputShow, setIsAddCategoryInputShow] = useState(false);
  const [categoryText, setCategoryText] = useState('');
  const [creating, setCreating] = useState(false);
  const categoryInputRef = useRef<InputRef>(null);

  // Fetch categories on mount if not already loaded
  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchProjectCategories());
    }
  }, [dispatch, categories.length]);

  const categoryOptions = categories.map((category, index) => ({
    key: index,
    value: category.id,
    label: safeTextDisplay(category.name),
  }));

  const handleCategoryInputFocus = () => {
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 0);
  };

  const handleShowAddCategoryInput = () => {
    if (isFree) {
      promptUpgrade();
      return;
    }
    setIsAddCategoryInputShow(true);
    handleCategoryInputFocus();
  };

  const handleSelectClick = () => {
    if (isFree) {
      promptUpgrade();
    }
  };

  // Refresh categories when dropdown opens to get latest updates
  const handleDropdownVisibleChange = (open: boolean) => {
    if (open) {
      dispatch(fetchProjectCategories());
    }
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
      <Form.Item
        name="category_id"
        label={
          <Flex align="center" gap={4}>
            <span>{t('category')}</span>
            {isFree && (
              <Tooltip title={tCommon('upgrade-plan')} placement="top">
                <CrownOutlined
                  style={{ fontSize: '14px', color: '#faad14', cursor: 'pointer' }}
                  onClick={handleSelectClick}
                />
              </Tooltip>
            )}
          </Flex>
        }
      >
        {!isAddCategoryInputShow ? (
          <Select
            options={categoryOptions}
            placeholder={t('addCategory')}
            loading={creating}
            allowClear
            onDropdownVisibleChange={handleDropdownVisibleChange}
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
            onClick={handleSelectClick}
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
