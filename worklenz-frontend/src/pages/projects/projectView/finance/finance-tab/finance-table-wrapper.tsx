import React from "react";
import { Card, Col, Row, Spin } from "antd";
import { useThemeContext } from "../../../../../context/theme-context";
import { FinanceTable } from "./finance-table";
import { IFinanceTable } from "./finance-table.interface";
import { IProjectFinanceGroup } from "../../../../../types/project/project-finance.types";

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
                table={table as unknown as IFinanceTable}
                loading={loading}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}; 