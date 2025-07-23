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
    <div style={{ position: 'relative', width: 240 }}>
      <Input
        placeholder={placeholderText}
        value={searchQuery}
        onChange={e => setSearchQuery(e.currentTarget.value)}
        style={{ padding: '4px 24px 4px 11px' }}
      />
      <span
        style={{
          position: 'absolute',
          top: '50%',
          right: 6,
          transform: 'translateY(-50%)',
        }}
      >
        <SearchOutlined style={{ fontSize: 14 }} />
      </span>
    </div>
  );
};

export default CustomSearchbar;
