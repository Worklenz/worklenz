import {
  Badge,
  Button,
  DatePicker,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  InputRef,
  Select,
  Tag,
  Typography,
} from '@/shared/antd-imports';
import React, { useRef, useState } from 'react';
import {
  healthStatusData,
  projectColors,
  statusData,
} from '../../../lib/project/project-constants';
import { PlusCircleOutlined, PlusOutlined, QuestionCircleOutlined } from '@/shared/antd-imports';
import { colors } from '../../../styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ProjectType } from '../../../types/project.types';
import { nanoid } from '@reduxjs/toolkit';
import { createProject, toggleDrawer, toggleUpdatedrawer } from '../projectSlice';
import ProjectList from '../../../pages/projects/ProjectList';
import { CategoryType } from '../../../types/categories.types';

const UpdateProjectDrawer = () => {
  const currentlyActiveTeamData = useAppSelector(state => state.teamReducer.teamsList).find(
    item => item.isActive
  );

  // get categories list from categories reducer
  let categoriesList = useAppSelector(state => state.categoriesReducer.categoriesList);

  // state for show category add input box
  const [isAddCategoryInputShow, setIsAddCategoryInputShow] = useState<boolean>(false);
  const [categoryText, setCategoryText] = useState<string>('');

  const isDrawerOpen = useAppSelector(state => state.projectReducer.isUpdateDrawerOpen);
  const dispatch = useAppDispatch();

  const [form] = Form.useForm();

  // status selection options
  const statusOptions = [
    ...statusData.map((status, index) => ({
      key: index,
      value: status.value,
      label: (
        <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {status.icon}
          {status.label}
        </Typography.Text>
      ),
    })),
  ];

  // health selection options
  const healthOptions = [
    ...healthStatusData.map((status, index) => ({
      key: index,
      value: status.value,
      label: (
        <Typography.Text style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Badge color={status.color} /> {status.label}
        </Typography.Text>
      ),
    })),
  ];

  // project color options
  const projectColorOptions = [
    ...projectColors.map((color, index) => ({
      key: index,
      value: color,
      label: (
        <Tag
          color={color}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
          }}
        />
      ),
    })),
  ];

  // category input ref
  const categoryInputRef = useRef<InputRef>(null);

  const handleCategoryInputFocus = (open: boolean) => {
    setTimeout(() => {
      categoryInputRef.current?.focus();
    }, 0);
  };

  // show input to add new category
  const handleShowAddCategoryInput = () => {
    setIsAddCategoryInputShow(true);
    handleCategoryInputFocus(true);
  };

  // function to handle category add
  const handleAddCategoryItem = (category: string) => {
    const newCategory: CategoryType = {
      categoryId: nanoid(),
      categoryName: category,
      categoryColor: '#ee87c5',
    };

    setCategoryText('');
    setIsAddCategoryInputShow(false);
  };

  interface DataType {
    key: string;
    name: string;
    client: string;
    category: string;
    status: string;
    totalTasks: number;
    completedTasks: number;
    lastUpdated: Date;
    startDate: Date | null;
    endDate: Date | null;
    members: string[];
  }

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>Update Project</Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleUpdatedrawer(''))}
    >
      {/* create project form  */}
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          color: projectColors[0],
          status: 'proposed',
          health: 'notSet',
          client: [],
          estWorkingDays: 0,
          estManDays: 0,
          hrsPerDay: 8,
        }}
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[
            {
              required: true,
              message: 'Please enter a Name',
            },
          ]}
        >
          <Input placeholder="Name" />
        </Form.Item>
        <Form.Item name="color" label="Project Color" layout="horizontal" required>
          <Select
            variant="borderless"
            suffixIcon={null}
            options={projectColorOptions}
            style={{
              width: 60,
            }}
          />
        </Form.Item>
        <Form.Item name="status" label="Status">
          <Select options={statusOptions} />
        </Form.Item>
        <Form.Item name="health" label="Health">
          <Select options={healthOptions} />
        </Form.Item>
        <Form.Item name="category" label="Category">
          {!isAddCategoryInputShow ? (
            <Select
              options={categoriesList}
              placeholder="Add a category to the project"
              dropdownRender={() => (
                <Button
                  style={{ width: '100%' }}
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleShowAddCategoryInput}
                >
                  New Category
                </Button>
              )}
            />
          ) : (
            <Flex vertical gap={4}>
              <Input
                ref={categoryInputRef}
                placeholder="Enter a name for the category"
                value={categoryText}
                onChange={e => setCategoryText(e.currentTarget.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategoryItem(categoryText)}
              />
              <Typography.Text style={{ color: colors.lightGray }}>
                Hit enter to create!
              </Typography.Text>
            </Flex>
          )}
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea placeholder="Notes" />
        </Form.Item>
        <Form.Item
          name="client"
          label={
            <Typography.Text>
              Client <QuestionCircleOutlined />
            </Typography.Text>
          }
        >
          <Input placeholder="Select client" />
        </Form.Item>
        <Form.Item name="projectManager" label="Project Manager" layout="horizontal">
          <Button type="dashed" shape="circle" icon={<PlusCircleOutlined />} />
        </Form.Item>
        <Form.Item name="date" layout="horizontal">
          <Flex gap={8}>
            <Form.Item name="startDate" label="Start Date">
              <DatePicker />
            </Form.Item>
            <Form.Item name="endDate" label="End Date">
              <DatePicker />
            </Form.Item>
          </Flex>
        </Form.Item>
        <Form.Item name="estWorkingDays" label="Estimate working days">
          <Input type="number" />
        </Form.Item>
        <Form.Item name="estManDays" label="Estimate man days">
          <Input type="number" />
        </Form.Item>
        <Form.Item name="hrsPerDay" label="Hours per day">
          <Input type="number" />
        </Form.Item>

        <Button type="primary" style={{ width: '100%' }} htmlType="submit">
          Save Changes
        </Button>
        <Button type="dashed" danger style={{ width: '100%', marginTop: '8px' }} htmlType="submit">
          Delete Project
        </Button>
      </Form>
      <Divider style={{ marginTop: '1rem', marginBottom: '0.5rem' }} />
      <div style={{ paddingBottom: '0.25rem', display: 'flex', flexDirection: 'column' }}>
        <Typography.Text type="secondary">
          <small> Created a day ago by Raveesha Dilanka </small>
        </Typography.Text>
        <Typography.Text type="secondary">
          <small> Updated a day ago </small>
        </Typography.Text>
      </div>
    </Drawer>
  );
};

export default UpdateProjectDrawer;
