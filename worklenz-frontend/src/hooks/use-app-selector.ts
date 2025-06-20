import { useSelector } from 'react-redux';
import { RootState } from '../app/store';

export const useAppSelector = useSelector.withTypes<RootState>();
