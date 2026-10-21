import { SearchOutlined } from '@/shared/antd-imports';
import { Input } from '@/shared/antd-imports';

type CustomSearchbarProps = {
  placeholderText: string;
  searchQuery: string;
  setSearchQuery: (searchText: string) => void;
};

const CustomSearchbar = ({
  placeholderText,
  searchQuery,
  setSearchQuery,
}: CustomSearchbarProps) => {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 240 }}>
      <Input
        prefix={<SearchOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />}
        placeholder={placeholderText}
        value={searchQuery}
        onChange={e => setSearchQuery(e.currentTarget.value)}
        style={{
          height: 32,
          fontSize: 12,
          borderRadius: 7,
        }}
      />
    </div>
  );
};

export default CustomSearchbar;
