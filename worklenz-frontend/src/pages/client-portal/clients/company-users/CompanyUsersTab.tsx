import { CompanyUsersStats } from './CompanyUsersStats';
import { CompanyUsersTable } from './CompanyUsersTable';

interface CompanyUsersTabProps {
  onOpenCompany: (clientId: string) => void;
  onAdd: () => void;
}

/** The Company Users view of the Clients page: the four stat cards and the table of every user. */
export const CompanyUsersTab = ({ onOpenCompany, onAdd }: CompanyUsersTabProps) => (
  <>
    <CompanyUsersStats />
    <CompanyUsersTable onOpenCompany={onOpenCompany} onAdd={onAdd} />
  </>
);
