import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '@/shared/antd-imports';

const mocks = vi.hoisted(() => ({
  onboard: vi.fn(),
  addUser: vi.fn(),
  invite: vi.fn(),
  importClients: vi.fn(),
  validate: vi.fn(),
  onClose: vi.fn(),
  onUpgradeRequired: vi.fn(),
  clientsQuery: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  usersQuery: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  projectsQuery: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      const isSingular = options.count === 1;
      let value = String(
        (isSingular ? options.defaultValue_one : options.defaultValue_other) ??
          options.defaultValue ??
          key
      );
      Object.entries(options).forEach(([param, paramValue]) => {
        value = value.split(`{{${param}}}`).join(String(paramValue));
      });
      return value;
    },
  }),
}));

vi.mock('@/api/client-portal/client-portal-api', () => ({
  useGetClientsQuery: () => mocks.clientsQuery,
}));

vi.mock('@/api/client-portal/company-users-api', () => ({
  useOnboardClientMutation: () => [mocks.onboard, { isLoading: false }],
  useAddCompanyUserToClientMutation: () => [mocks.addUser, { isLoading: false }],
  useInviteCompanyUserMutation: () => [mocks.invite, { isLoading: false }],
  useImportClientsMutation: () => [mocks.importClients, { isLoading: false }],
  useValidateClientImportMutation: () => [mocks.validate, { isLoading: false }],
  useGetCompanyUsersQuery: () => mocks.usersQuery,
  useGetClientProjectsListQuery: () => mocks.projectsQuery,
}));

import { AddClientWizard } from './AddClientWizard';

const resolves = (body: unknown) => ({ unwrap: () => Promise.resolve({ done: true, body }) });

const NOT_INVITED = {
  requested: false,
  delivery: 'email',
  email_sent: false,
  link: null,
  expires_at: null,
  error: null,
};

const renderWizard = (props: Partial<{ canCreate: boolean }> = {}) =>
  render(
    <AddClientWizard
      open
      onClose={mocks.onClose}
      canCreate={props.canCreate ?? true}
      onUpgradeRequired={mocks.onUpgradeRequired}
    />
  );

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const continueButton = () => button('Continue');

const pickMethod = (name: RegExp) => {
  fireEvent.click(screen.getByRole('radio', { name }));
  fireEvent.click(continueButton());
};

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

// jsdom's selector engine mis-reads a "+" inside an attribute selector, so compare titles directly.
const chooseSelectOption = (title: string) => {
  const option = Array.from(document.querySelectorAll('.ant-select-item-option')).find(
    element => element.getAttribute('title') === title
  );
  expect(option, `option "${title}"`).toBeTruthy();
  fireEvent.click(option as Element);
};

const company = (id: string, name: string, users = 2) => ({
  id,
  name,
  company_name: name,
  status: 'active',
  company_users_count: users,
});

const fillNewClient = () => {
  type(/Company name/, 'Beacon Logistics');
  type(/First name/, 'Jane');
  type(/Last name/, 'Doe');
  type(/Email address/, 'jane@beacon.io');
};

describe('AddClientWizard', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(value => {
      if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
    });
    mocks.clientsQuery.data = undefined;
    mocks.usersQuery.data = undefined;
    mocks.projectsQuery.data = undefined;
    mocks.projectsQuery.isSuccess = true;
    mocks.onboard.mockReturnValue(
      resolves({
        client: { id: 'c9', name: 'Beacon Logistics' },
        user: { name: 'Jane Doe' },
        invite: NOT_INVITED,
      })
    );
    mocks.addUser.mockReturnValue(resolves({ user: { name: 'Sam Lee' }, invite: NOT_INVITED }));
    mocks.invite.mockReturnValue(
      resolves({
        email: 'alex@avant.io',
        delivery: 'email',
        email_sent: true,
        link: null,
        expires_at: null,
      })
    );
  });

  afterEach(() => {
    Modal.destroyAll();
  });

  describe('choosing a method', () => {
    it('offers the four ways to add a client', () => {
      renderWizard();

      ['New client', 'Add a client user', 'Invite an existing contact', 'Import from CSV'].forEach(
        name => expect(screen.getByRole('radio', { name: new RegExp(name) })).toBeInTheDocument()
      );
    });

    it('cannot continue until a method is chosen', () => {
      renderWizard();

      expect(continueButton()).toBeDisabled();
      fireEvent.click(screen.getByRole('radio', { name: /New client/ }));
      expect(continueButton()).toBeEnabled();
    });

    it('goes back to the choice with the earlier selection kept', () => {
      renderWizard();
      pickMethod(/New client/);
      fireEvent.click(button('Back'));

      expect(screen.getByRole('radio', { name: /New client/ })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });
  });

  describe('new client', () => {
    it('needs a first name and a valid email before it continues', () => {
      renderWizard();
      pickMethod(/New client/);

      expect(continueButton()).toBeDisabled();
      type(/First name/, 'Jane');
      type(/Email address/, 'not-an-email');
      fireEvent.blur(screen.getByLabelText(/Email address/));
      expect(continueButton()).toBeDisabled();
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();

      type(/Email address/, 'jane@beacon.io');
      expect(continueButton()).toBeEnabled();
    });

    it('does not need a company name', () => {
      renderWizard();
      pickMethod(/New client/);
      type(/First name/, 'Jane');
      type(/Email address/, 'jane@beacon.io');

      expect(continueButton()).toBeEnabled();
    });

    it('reviews the client with Jane as POC and adds it, sending the invite by default', async () => {
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());

      expect(screen.getByText('Review & send')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Beacon Logistics')).toBeInTheDocument();
      expect(screen.getByText('POC (default for a new company)')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Send portal invite now/ })).toBeChecked();

      fireEvent.click(button('Add Client & Send Invite'));

      await waitFor(() =>
        expect(mocks.onboard).toHaveBeenCalledWith({
          company_name: 'Beacon Logistics',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@beacon.io',
          phone: undefined,
          job_title: undefined,
          send_invite: true,
          delivery: 'email',
          welcome_message:
            'Hi Jane, welcome to your client portal. Send us a message here any time.',
        })
      );
      expect(mocks.onClose).toHaveBeenCalled();
    });

    it('can be added without inviting anyone', async () => {
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());

      fireEvent.click(screen.getByRole('checkbox', { name: /Send portal invite now/ }));
      expect(
        screen.getByText(/Not invited yet\. Invite them later from the table\./)
      ).toBeInTheDocument();
      expect(screen.queryByText('DELIVER VIA')).not.toBeInTheDocument();

      fireEvent.click(button('Add Client'));

      await waitFor(() =>
        expect(mocks.onboard).toHaveBeenCalledWith(expect.objectContaining({ send_invite: false }))
      );
    });

    it('skips the welcome message when it was unchecked', async () => {
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(screen.getByRole('checkbox', { name: /Send a welcome message/ }));
      fireEvent.click(continueButton());
      fireEvent.click(button('Add Client & Send Invite'));

      await waitFor(() =>
        expect(mocks.onboard).toHaveBeenCalledWith(
          expect.objectContaining({ welcome_message: null })
        )
      );
    });

    it('offers the invitation link to copy when that delivery was chosen', async () => {
      mocks.onboard.mockReturnValue(
        resolves({
          client: { id: 'c9', name: 'Beacon' },
          user: { name: 'Jane Doe' },
          invite: {
            ...NOT_INVITED,
            requested: true,
            delivery: 'link',
            link: 'https://portal.test/invite?token=wli_abc',
          },
        })
      );
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());
      fireEvent.click(screen.getByRole('radio', { name: 'Copy invitation link' }));
      fireEvent.click(button('Add Client & Send Invite'));

      expect(
        await screen.findByText('https://portal.test/invite?token=wli_abc')
      ).toBeInTheDocument();
      expect(mocks.onboard).toHaveBeenCalledWith(expect.objectContaining({ delivery: 'link' }));
    });

    it('does not claim the client signs in without a password', () => {
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());

      expect(screen.getByText(/They set a password on first sign-in/)).toBeInTheDocument();
      expect(screen.queryByText(/no password/i)).not.toBeInTheDocument();
    });

    it('keeps the wizard open and shows the server’s reason when saving fails', async () => {
      mocks.onboard.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: 'A client named "Beacon Logistics" already exists' } }),
      });
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());
      fireEvent.click(button('Add Client & Send Invite'));

      expect(
        await screen.findByText('A client named "Beacon Logistics" already exists')
      ).toBeInTheDocument();
      expect(mocks.onClose).not.toHaveBeenCalled();
    });

    it('keeps the client when only the invitation failed', async () => {
      mocks.onboard.mockReturnValue(
        resolves({
          client: { id: 'c9', name: 'Beacon' },
          user: { name: 'Jane Doe' },
          invite: { ...NOT_INVITED, requested: true, error: 'SES is down' },
        })
      );
      renderWizard();
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());
      fireEvent.click(button('Add Client & Send Invite'));

      expect(
        await screen.findByText(/was saved, but the invitation could not be sent \(SES is down\)/)
      ).toBeInTheDocument();
      expect(mocks.onClose).toHaveBeenCalled();
    });
  });

  describe('company user', () => {
    beforeEach(() => {
      mocks.clientsQuery.data = {
        body: { clients: [company('c1', 'Brandbase', 2), company('c2', 'Avant', 1)], total: 2 },
      };
      mocks.projectsQuery.data = {
        body: {
          projects: [
            { id: 'p1', name: 'Site' },
            { id: 'p2', name: 'Brand' },
          ],
          total: 2,
        },
      };
    });

    const chooseCompany = (name: string) => {
      pickMethod(/Add a client user/);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    };

    it('lists companies with how many users they have, and only shows the form once one is chosen', () => {
      renderWizard();
      pickMethod(/Add a client user/);

      expect(
        screen.getByRole('button', { name: /Brandbase.*2 existing users/ })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Avant.*1 existing user$/ })).toBeInTheDocument();
      expect(screen.queryByLabelText(/First name/)).not.toBeInTheDocument();
      expect(continueButton()).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /Brandbase/ }));
      expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
    });

    it('does not offer a deactivated company', () => {
      mocks.clientsQuery.data = {
        body: {
          clients: [company('c1', 'Brandbase'), { ...company('c3', 'Old Co'), status: 'inactive' }],
          total: 2,
        },
      };
      renderWizard();
      pickMethod(/Add a client user/);

      expect(screen.queryByText('Old Co')).not.toBeInTheDocument();
    });

    it('lets the company be changed after choosing it', () => {
      renderWizard();
      chooseCompany('Brandbase');

      fireEvent.click(button('Change'));

      expect(screen.getByRole('button', { name: /Avant/ })).toBeInTheDocument();
    });

    it('shows how a template applies to the company’s projects', () => {
      renderWizard();
      chooseCompany('Brandbase');

      fireEvent.mouseDown(screen.getByRole('combobox', { name: /Project access/ }));
      chooseSelectOption('Standard Contact — View + comment');

      expect(
        screen.getByText(/Grants Standard Contact access to all 2 of Brandbase’s current projects/)
      ).toBeInTheDocument();
    });

    it('adds a POC with a template applied to every current project', async () => {
      renderWizard();
      chooseCompany('Brandbase');
      type(/First name/, 'Sam');
      type(/Last name/, 'Lee');
      type(/Email address/, 'sam@brandbase.com');
      fireEvent.click(screen.getByRole('checkbox', { name: /Make this user a POC/ }));
      fireEvent.mouseDown(screen.getByRole('combobox', { name: /Project access/ }));
      chooseSelectOption('Full Partner — Full contributor');
      fireEvent.click(continueButton());

      expect(screen.getByText('Full Partner on all 2 current projects')).toBeInTheDocument();
      expect(screen.getByText('POC')).toBeInTheDocument();

      fireEvent.click(button('Add User & Send Invite'));

      await waitFor(() =>
        expect(mocks.addUser).toHaveBeenCalledWith({
          clientId: 'c1',
          body: {
            first_name: 'Sam',
            last_name: 'Lee',
            email: 'sam@brandbase.com',
            phone: undefined,
            job_title: undefined,
            role: 'poc',
            project_access: [
              { project_id: 'p1', level: 'contributor' },
              { project_id: 'p2', level: 'contributor' },
            ],
            send_invite: true,
            delivery: 'email',
          },
        })
      );
      expect(mocks.onClose).toHaveBeenCalled();
    });

    it('adds a member with no access when no template is chosen', async () => {
      renderWizard();
      chooseCompany('Avant');
      type(/First name/, 'Sam');
      type(/Email address/, 'sam@avant.io');
      fireEvent.click(continueButton());

      expect(screen.getByText('Client user')).toBeInTheDocument();
      expect(screen.getByText('None yet. Assign projects afterwards.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('checkbox', { name: /Send portal invite now/ }));
      fireEvent.click(button('Add Client User'));

      await waitFor(() =>
        expect(mocks.addUser).toHaveBeenCalledWith({
          clientId: 'c2',
          body: expect.objectContaining({ role: 'member', project_access: [], send_invite: false }),
        })
      );
    });

    it('disables the template with an explanation when the company has no projects', () => {
      mocks.projectsQuery.data = { body: { projects: [], total: 0 } };
      renderWizard();
      chooseCompany('Brandbase');

      expect(screen.getByRole('combobox', { name: /Project access/ })).toBeDisabled();
      expect(
        screen.getByText(
          'Brandbase has no projects yet, so there is nothing to apply a template to.'
        )
      ).toBeInTheDocument();
    });

    it('does not carry a template over to another company', () => {
      renderWizard();
      chooseCompany('Brandbase');
      fireEvent.mouseDown(screen.getByRole('combobox', { name: /Project access/ }));
      chooseSelectOption('View Only — View only');

      fireEvent.click(button('Change'));
      fireEvent.click(screen.getByRole('button', { name: /Avant/ }));

      expect(
        screen.getByText(/Pick a template to grant access to every current project at once/)
      ).toBeInTheDocument();
    });
  });

  describe('existing contact', () => {
    beforeEach(() => {
      mocks.usersQuery.data = {
        body: {
          users: [
            { id: 'u1', name: 'Alex Chen', email: 'alex@avant.io', company_name: 'Avant' },
            {
              id: 'u2',
              name: 'Dilshan Perera',
              email: 'dilshan@x.io',
              company_name: 'Dilshan Perera',
            },
          ],
          total: 2,
        },
      };
    });

    it('lists the people without working access', () => {
      renderWizard();
      pickMethod(/Invite an existing contact/);

      expect(screen.getByText('Contacts without active portal access.')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Alex Chen/ })).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();
    });

    it('always sends the invite: there is nothing to defer', async () => {
      renderWizard();
      pickMethod(/Invite an existing contact/);
      fireEvent.click(screen.getByRole('radio', { name: /Alex Chen/ }));
      fireEvent.click(continueButton());

      expect(screen.getByText('Alex Chen')).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: /Send portal invite now/ })
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Role')).not.toBeInTheDocument();

      fireEvent.click(button('Send Invite'));

      await waitFor(() =>
        expect(mocks.invite).toHaveBeenCalledWith({ id: 'u1', delivery: 'email' })
      );
      expect(mocks.onClose).toHaveBeenCalled();
    });

    it('hands over the link when copy was chosen', async () => {
      mocks.invite.mockReturnValue(
        resolves({
          email: 'alex@avant.io',
          delivery: 'link',
          email_sent: false,
          link: 'https://portal.test/invite?token=wli_xyz',
          expires_at: null,
        })
      );
      renderWizard();
      pickMethod(/Invite an existing contact/);
      fireEvent.click(screen.getByRole('radio', { name: /Alex Chen/ }));
      fireEvent.click(continueButton());
      fireEvent.click(screen.getByRole('radio', { name: 'Copy invitation link' }));
      fireEvent.click(button('Send Invite'));

      expect(
        await screen.findByText('https://portal.test/invite?token=wli_xyz')
      ).toBeInTheDocument();
      expect(mocks.invite).toHaveBeenCalledWith({ id: 'u1', delivery: 'link' });
    });

    it('says when everyone already has access', () => {
      mocks.usersQuery.data = { body: { users: [], total: 0 } };
      renderWizard();
      pickMethod(/Invite an existing contact/);

      expect(screen.getByText('Everyone already has active portal access.')).toBeInTheDocument();
    });
  });

  describe('CSV import', () => {
    const csvFile = (content: string, name = 'clients.csv') =>
      new File([content], name, { type: 'text/csv' });

    const chooseFile = async (file: File) => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
    };

    const validation = (overrides: Record<string, unknown> = {}) => ({
      summary: { total: 2, valid: 2, invalid: 0, new_companies: 1, existing_companies: 1 },
      rows: [
        {
          row: 1,
          status: 'ok',
          errors: [],
          name: 'Jane Doe',
          email: 'jane@beacon.io',
          company: 'Beacon',
          company_exists: false,
        },
        {
          row: 2,
          status: 'ok',
          errors: [],
          name: 'Sam Lee',
          email: 'sam@avant.io',
          company: 'Avant',
          company_exists: true,
        },
      ],
      ...overrides,
    });

    beforeEach(() => {
      mocks.validate.mockReturnValue(resolves(validation()));
    });

    it('checks the file and reports what would happen', async () => {
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(
        csvFile(
          'Company,First name,Last name,Email\nBeacon,Jane,Doe,jane@beacon.io\nAvant,Sam,Lee,sam@avant.io\n'
        )
      );

      expect(await screen.findByText('2 of 2 rows are ready to import.')).toBeInTheDocument();
      expect(mocks.validate).toHaveBeenCalledWith({
        rows: [
          { company: 'Beacon', first_name: 'Jane', last_name: 'Doe', email: 'jane@beacon.io' },
          { company: 'Avant', first_name: 'Sam', last_name: 'Lee', email: 'sam@avant.io' },
        ],
      });
      expect(screen.getByText(/Nobody is emailed/)).toBeInTheDocument();
      expect(button('Import')).toBeEnabled();
    });

    it('imports and shows the outcome', async () => {
      mocks.importClients.mockReturnValue(
        resolves({ created_companies: 1, added_users: 2, skipped: 0, rows: validation().rows })
      );
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('First name,Email\nJane,jane@beacon.io\nSam,sam@avant.io\n'));
      await screen.findByText('2 of 2 rows are ready to import.');

      fireEvent.click(button('Import'));

      expect(
        await screen.findByText(/1 companies created, 2 users added, 0 rows skipped/)
      ).toBeInTheDocument();
      expect(mocks.importClients).toHaveBeenCalledWith({ rows: expect.any(Array) });
      expect(button('Done')).toBeInTheDocument();
    });

    it('lists the rows with problems in plain words and still allows the rest', async () => {
      mocks.validate.mockReturnValue(
        resolves(
          validation({
            summary: { total: 2, valid: 1, invalid: 1, new_companies: 1, existing_companies: 0 },
            rows: [
              {
                row: 1,
                status: 'ok',
                errors: [],
                name: 'Jane Doe',
                email: 'jane@beacon.io',
                company: 'Beacon',
                company_exists: false,
              },
              {
                row: 2,
                status: 'error',
                errors: ['invalid_email', 'missing_first_name'],
                name: '',
                email: 'nope',
                company: '',
                company_exists: false,
              },
            ],
          })
        )
      );
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('First name,Email\nJane,jane@beacon.io\n,nope\n'));

      expect(await screen.findByText('1 of 2 rows are ready to import.')).toBeInTheDocument();
      expect(screen.getByText('Email is not valid')).toBeInTheDocument();
      expect(screen.getByText('First name is missing')).toBeInTheDocument();
      // Only the rows with problems are listed.
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
      expect(button('Import')).toBeEnabled();
    });

    it('will not import when no row is acceptable', async () => {
      mocks.validate.mockReturnValue(
        resolves(
          validation({
            summary: { total: 1, valid: 0, invalid: 1, new_companies: 0, existing_companies: 0 },
            rows: [
              {
                row: 1,
                status: 'error',
                errors: ['email_in_use'],
                name: 'Sam',
                email: 'sam@x.io',
                company: '',
                company_exists: false,
              },
            ],
          })
        )
      );
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('First name,Email\nSam,sam@x.io\n'));

      expect(await screen.findByText('None of the rows can be imported.')).toBeInTheDocument();
      expect(button('Import')).toBeDisabled();
    });

    it('rejects a file that is not a CSV without contacting the server', async () => {
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('x', 'clients.xlsx'));

      expect(await screen.findByText('Choose a .csv file.')).toBeInTheDocument();
      expect(mocks.validate).not.toHaveBeenCalled();
      expect(button('Import')).toBeDisabled();
    });

    it('names the columns a file is missing', async () => {
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('Company,Last name\nBeacon,Doe\n'));

      expect(
        await screen.findByText(
          'The file needs a header row with these columns: First name, Email.'
        )
      ).toBeInTheDocument();
      expect(mocks.validate).not.toHaveBeenCalled();
    });

    it('lets another file be chosen', async () => {
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('First name,Email\nJane,jane@beacon.io\n'));
      await screen.findByText('2 of 2 rows are ready to import.');

      fireEvent.click(button('Choose another file'));

      expect(screen.getByText('Click to choose a CSV file, or drag it here')).toBeInTheDocument();
      expect(button('Import')).toBeDisabled();
    });

    it('shows the server’s message when the file could not be checked', async () => {
      mocks.validate.mockReturnValue({
        unwrap: () =>
          Promise.reject({ data: { message: 'A file can have at most 500 rows (it has 501)' } }),
      });
      renderWizard();
      pickMethod(/Import from CSV/);
      await chooseFile(csvFile('First name,Email\nJane,jane@beacon.io\n'));

      expect(
        await screen.findByText('A file can have at most 500 rows (it has 501)')
      ).toBeInTheDocument();
    });
  });

  describe('started from a company', () => {
    it('opens on the user’s details for that company, skipping the choice of method and company', () => {
      mocks.projectsQuery.data = { body: { projects: [{ id: 'p1', name: 'Site' }], total: 1 } };
      render(
        <AddClientWizard
          open
          preset={{ method: 'user', company: { id: 'c1', name: 'Brandbase' } }}
          onClose={mocks.onClose}
          canCreate
          onUpgradeRequired={mocks.onUpgradeRequired}
        />
      );

      expect(screen.getByText('Brandbase')).toBeInTheDocument();
      expect(screen.getByLabelText(/First name/)).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /New client/ })).not.toBeInTheDocument();
      expect(button('Back')).toBeInTheDocument();
    });

    it('adds the user to that company', async () => {
      mocks.projectsQuery.data = { body: { projects: [{ id: 'p1', name: 'Site' }], total: 1 } };
      render(
        <AddClientWizard
          open
          preset={{ method: 'user', company: { id: 'c1', name: 'Brandbase' } }}
          onClose={mocks.onClose}
          canCreate
          onUpgradeRequired={mocks.onUpgradeRequired}
        />
      );
      type(/First name/, 'Sam');
      type(/Email address/, 'sam@brandbase.com');
      fireEvent.click(continueButton());
      fireEvent.click(button('Add User & Send Invite'));

      await waitFor(() =>
        expect(mocks.addUser).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1' }))
      );
    });

    it('goes back to the choice of method, so it can still be changed', () => {
      render(
        <AddClientWizard
          open
          preset={{ method: 'user', company: { id: 'c1', name: 'Brandbase' } }}
          onClose={mocks.onClose}
          canCreate
          onUpgradeRequired={mocks.onUpgradeRequired}
        />
      );

      fireEvent.click(button('Back'));

      expect(screen.getByRole('radio', { name: /New client/ })).toBeInTheDocument();
    });
  });

  describe('plans without the client portal', () => {
    it('asks to upgrade instead of saving a new client', async () => {
      renderWizard({ canCreate: false });
      pickMethod(/New client/);
      fillNewClient();
      fireEvent.click(continueButton());
      fireEvent.click(button('Add Client & Send Invite'));

      await waitFor(() => expect(mocks.onUpgradeRequired).toHaveBeenCalled());
      expect(mocks.onboard).not.toHaveBeenCalled();
      expect(mocks.onClose).not.toHaveBeenCalled();
    });

    it('asks to upgrade instead of importing', async () => {
      mocks.validate.mockReturnValue(
        resolves({
          summary: { total: 1, valid: 1, invalid: 0, new_companies: 1, existing_companies: 0 },
          rows: [],
        })
      );
      renderWizard({ canCreate: false });
      pickMethod(/Import from CSV/);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, {
        target: {
          files: [
            new File(['First name,Email\nJane,jane@beacon.io\n'], 'c.csv', { type: 'text/csv' }),
          ],
        },
      });
      await screen.findByText('1 of 1 rows are ready to import.');

      fireEvent.click(button('Import'));

      await waitFor(() => expect(mocks.onUpgradeRequired).toHaveBeenCalled());
      expect(mocks.importClients).not.toHaveBeenCalled();
    });
  });

  it('closes from the first step with Cancel', () => {
    renderWizard();

    fireEvent.click(button('Cancel'));

    expect(mocks.onClose).toHaveBeenCalled();
  });
});
