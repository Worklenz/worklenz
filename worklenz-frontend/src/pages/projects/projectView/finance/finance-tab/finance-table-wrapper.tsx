import React from "react";
import { Card, Col, Row } from "antd";

import { IProjectFinanceGroup } from "../../../../../types/project/project-finance.types";
import FinanceTable from "./finance-table/finance-table";

interface Props {
  activeTablesList: IProjectFinanceGroup[];
  loading: boolean;
}

export const FinanceTableWrapper: React.FC<Props> = ({ activeTablesList, loading }) => {
  const { isDarkMode } = useThemeContext();

  const getTableColor = (table: IProjectFinanceGroup) => {
    return isDarkMode ? table.color_code_dark : table.color_code;
  };

  return (
    <div className="finance-table-wrapper">
      <Row gutter={[16, 16]}>
        {activeTablesList.map((table) => (
          <Col key={table.group_id} xs={24} sm={24} md={24} lg={24} xl={24}>
            <Card
              className="finance-table-card"
              style={{
                borderTop: `3px solid ${getTableColor(table)}`,
              }}
            >
              <div className="finance-table-header">
                <h3>{table.group_name}</h3>
              </div>
              <FinanceTable
                table={table}
                loading={loading}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}; 