import { createSlice } from '@reduxjs/toolkit';
import { TempServicesType } from '../../../types/client-portal/temp-client-portal.types';

const tempServices: TempServicesType[] = [
  {
    id: '1',
    name: 'Marketing video',
    created_by: 'sachintha prasad',
    status: 'pending',
    no_of_requests: 20,
    service_data: {
      description: 'A promotional marketing video service.',
      images: [],
      request_form: [
        {
          type: 'text',
          question: 'Project Title/Name',
          answer: null,
        },
        {
          type: 'text',
          question: 'Desired length of the video',
          answer: null,
        },
        {
          type: 'multipleChoice',
          question: 'Preferred video style',
          answer: ['Live-action', 'Animated', 'Mixed media'],
        },
        {
          type: 'attachment',
          question: 'Samples',
          answer: null,
        },
      ],
    },
  },
  {
    id: '2',
    name: 'Product portfolio video',
    created_by: 'sachintha prasad',
    status: 'inProgress',
    no_of_requests: 10,
    service_data: {
      description: 'A product showcase video service.',
      images: [],
      request_form: [
        {
          type: 'text',
          question: 'Company Name',
          answer: null,
        },
        {
          type: 'text',
          question: 'Target Audience',
          answer: null,
        },
        {
          type: 'multipleChoice',
          question: 'Video Purpose',
          answer: ['Brand Awareness', 'Product Launch', 'Sales Boost'],
        },
        {
          type: 'attachment',
          question: 'Reference Videos',
          answer: null,
        },
      ],
    },
  },
  {
    id: '3',
    name: 'Animated video',
    created_by: 'sachintha prasad',
    status: 'accepted',
    no_of_requests: 30,
    service_data: {
      description: 'An animated explainer video service.',
      images: [],
      request_form: [
        {
          type: 'text',
          question: 'Storyline or Concept',
          answer: null,
        },
        {
          type: 'text',
          question: 'Expected Video Duration',
          answer: null,
        },
        {
          type: 'multipleChoice',
          question: 'Animation Style',
          answer: ['2D', '3D', 'Whiteboard'],
        },
      ],
    },
  },
  {
    id: '4',
    name: 'Corporate Training Video',
    created_by: 'alexander smith',
    status: 'pending',
    no_of_requests: 12,
    service_data: {
      description: 'A video service for corporate training and onboarding.',
      images: [],
      request_form: [
        {
          type: 'text',
          question: 'Training Topic',
          answer: null,
        },
        {
          type: 'text',
          question: 'Number of Employees',
          answer: null,
        },
        {
          type: 'multipleChoice',
          question: 'Preferred Language',
          answer: ['English', 'Spanish', 'French'],
        },
        {
          type: 'attachment',
          question: 'Reference Materials',
          answer: null,
        },
      ],
    },
  },
];

type ServicesState = {
  services: TempServicesType[];
  isRequestFormModalOpen: boolean;
};

const initialState: ServicesState = {
  services: tempServices,
  isRequestFormModalOpen: false,
};

const clientViewServices = createSlice({
  name: 'servicesReducer',
  initialState,
  reducers: {
    toggleRequestFormModal: state => {
      state.isRequestFormModalOpen = !state.isRequestFormModalOpen;
    },
  },
});

export const { toggleRequestFormModal } = clientViewServices.actions;
export default clientViewServices.reducer;
