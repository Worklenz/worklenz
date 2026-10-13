import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Typography, message, theme } from '@/shared/antd-imports';
import homePageApi, {
  useCreatePersonalTaskMutation,
  useGetPersonalTasksQuery,
  useMarkPersonalTaskAsDoneMutation,
} from '@/api/home-page/home-page.api.service';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import type { IMyTask } from '@/types/home/my-tasks.types';
import { HomeWidgetCard, WidgetEmpty, WidgetError, WidgetLoading } from '../home-widgets/HomeWidgetCard';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';

const TODO_LIMIT = 6;
const TODO_PAGE_PATH = '/worklenz/home/todo';

/** The user's personal to-dos: add one, tick one off. The full list lives on the To-do page. */
export const HomeTodoWidget: React.FC = () => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  // To-dos ticked off but not yet gone from the server's answer: hidden at once so the tick feels instant.
  const [completingIds, setCompletingIds] = useState<ReadonlySet<string>>(new Set());

  const { data, isLoading, isError, refetch } = useGetPersonalTasksQuery(undefined, {
    refetchOnMountOrArgChange: 30,
  });
  const [createTodo, { isLoading: isCreating }] = useCreatePersonalTaskMutation();
  const [markDone] = useMarkPersonalTaskAsDoneMutation();

  // Both the To-do page and this widget read the same tag, so they stay in step.
  const reload = () => dispatch(homePageApi.util.invalidateTags(['personalTasks']));

  const openTodos = (data?.body ?? []).filter(todo => !todo.done && !completingIds.has(todo.id ?? ''));
  const shownTodos = openTodos.slice(0, TODO_LIMIT);
  const hiddenCount = openTodos.length - shownTodos.length;

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || isCreating) return;
    const newTodo: IMyTask = { name: trimmed, done: false, is_task: false, color_code: '#000', manual_progress: false };
    const result = await createTodo(newTodo);
    if (result.data?.done) {
      setName('');
      reload();
    } else {
      message.error(t('todoWidget.addFailed', { defaultValue: "Couldn't add that to-do. Please try again." }));
    }
  };

  const handleComplete = async (id: string) => {
    setCompletingIds(previous => new Set(previous).add(id));
    const result = await markDone(id);
    if (!result.data?.done) {
      setCompletingIds(previous => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      message.error(t('todoWidget.completeFailed', { defaultValue: "Couldn't update that to-do. Please try again." }));
      return;
    }
    reload();
  };

  return (
    <HomeWidgetCard title={t('customize.widgets.todo', { defaultValue: 'My todo list' })}>
      <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}>
        <Input
          size="small"
          value={name}
          maxLength={200}
          disabled={isCreating}
          placeholder={t('todoWidget.addPlaceholder', { defaultValue: 'Add a to-do and press Enter' })}
          aria-label={t('todoWidget.addLabel', { defaultValue: 'New to-do' })}
          onChange={event => setName(event.target.value)}
          onPressEnter={handleAdd}
          style={{ marginBottom: 12 }}
        />
      </div>

      {isLoading && <WidgetLoading />}
      {isError && !data && <WidgetError onRetry={refetch} />}
      {data &&
        (shownTodos.length === 0 ? (
          <WidgetEmpty text={t('todoWidget.empty', { defaultValue: "You're all caught up." })} />
        ) : (
          <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shownTodos.map(todo => (
              <Checkbox key={todo.id} checked={false} onChange={() => handleComplete(todo.id ?? '')}>
                <Typography.Text style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{todo.name}</Typography.Text>
              </Checkbox>
            ))}
          </div>
        ))}

      {data && (hiddenCount > 0 || shownTodos.length > 0) && (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(TODO_PAGE_PATH)}
          style={{ padding: 0, marginTop: 12, color: token.colorPrimary }}
        >
          {hiddenCount > 0
            ? t('todoWidget.viewAllMore', { defaultValue: 'View all ({{remaining}} more)', remaining: hiddenCount })
            : t('todoWidget.viewAll', { defaultValue: 'Open my todo list' })}
        </Button>
      )}
    </HomeWidgetCard>
  );
};

export default HomeTodoWidget;
