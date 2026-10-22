import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { whatsNewApiService } from '@/api/whats-new/whats-new.api.service';
import { ILatestWhatsNewRelease, IWhatsNewRelease } from '@/types/whats-new/whats-new.types';

type LatestReleaseStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

type WhatsNewState = {
  currentRelease: IWhatsNewRelease | null;
  isModalOpen: boolean;
  loading: boolean;
  // Viewer: independent of currentRelease/isModalOpen above, so opening it
  // can never touch the nav tag's own dismissal state on its own. Opened from
  // the notification drawer (notfication-drawer.tsx's goToUrl), which never
  // dismisses anything, and from Settings > Help (openLatestReleaseViewer),
  // which dismisses on close only when the release was tag-eligible.
  viewedRelease: IWhatsNewRelease | null;
  isViewedModalOpen: boolean;
  viewedLoading: boolean;
  viewedNotFound: boolean;
  // Whether the viewer shows the "New" badge. Only Help can turn it off
  // (release older than the 7-day window); the drawer flow always shows it.
  viewedShowNewBadge: boolean;
  // Whether closing the viewer records a dismissal. True only when Help opened
  // a release the nav tag is currently showing; the drawer flow never sets it.
  viewedDismissOnClose: boolean;
  // Latest published release for Settings > Help, independent of the tag's
  // expiry and dismissals (see GET /whats-new/latest).
  latestRelease: ILatestWhatsNewRelease | null;
  latestStatus: LatestReleaseStatus;
};

const initialState: WhatsNewState = {
  currentRelease: null,
  isModalOpen: false,
  loading: false,
  viewedRelease: null,
  isViewedModalOpen: false,
  viewedLoading: false,
  viewedNotFound: false,
  viewedShowNewBadge: true,
  viewedDismissOnClose: false,
  latestRelease: null,
  latestStatus: 'idle',
};

export const fetchCurrentRelease = createAsyncThunk('whatsNew/fetchCurrentRelease', async () => {
  const res = await whatsNewApiService.getCurrent();
  return res.body ?? null;
});

export const fetchReleaseById = createAsyncThunk('whatsNew/fetchReleaseById', async (releaseId: string) => {
  const res = await whatsNewApiService.getById(releaseId);
  return res.body ?? null;
});

export const fetchLatestRelease = createAsyncThunk('whatsNew/fetchLatestRelease', async () => {
  const res = await whatsNewApiService.getLatest();
  return res.body ?? null;
});

// Fire-and-forget from the caller's perspective (FR-3.9 / EC-25): the reducer
// hides the release optimistically in the `.pending` case below, before this
// network call resolves, and does not roll back on failure within the same
// session — the tag/card stay hidden either way, only reappearing on the
// next app load if the write never landed server-side.
export const dismissRelease = createAsyncThunk(
  'whatsNew/dismissRelease',
  async (releaseId: string) => {
    try {
      await whatsNewApiService.dismiss(releaseId);
    } catch {
      // Swallowed on purpose - see the optimistic-hide note above.
    }
  }
);

const whatsNewSlice = createSlice({
  name: 'whatsNewReducer',
  initialState,
  reducers: {
    openWhatsNewModal: state => {
      state.isModalOpen = true;
    },
    closeWhatsNewModal: state => {
      state.isModalOpen = false;
    },
    // Only ever clears the viewer's own open flag — never dismisses anything,
    // never touches currentRelease/isModalOpen or user_release_dismissals.
    closeReleaseViewer: state => {
      state.isViewedModalOpen = false;
    },
    // Opens the already-fetched latest release in the viewer (Settings > Help).
    // `currentRelease` is non-null exactly when the nav tag is showing a
    // release (active, inside the window, not dismissed), so matching its id is
    // what "currently eligible for the nav tag" means — closing then dismisses
    // it, just like closing the tag's own modal. Anything else writes nothing.
    openLatestReleaseViewer: state => {
      const latest = state.latestRelease;
      if (!latest) return;

      state.viewedRelease = latest;
      state.viewedLoading = false;
      state.viewedNotFound = false;
      state.viewedShowNewBadge = latest.is_new;
      state.viewedDismissOnClose = state.currentRelease?.id === latest.id;
      state.isViewedModalOpen = true;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchCurrentRelease.pending, state => {
      state.loading = true;
    });
    builder.addCase(fetchCurrentRelease.fulfilled, (state, action) => {
      state.loading = false;
      state.currentRelease = action.payload;
    });
    builder.addCase(fetchCurrentRelease.rejected, state => {
      state.loading = false;
    });
    builder.addCase(dismissRelease.pending, state => {
      state.currentRelease = null;
      state.isModalOpen = false;
    });
    builder.addCase(fetchLatestRelease.pending, state => {
      state.latestStatus = 'loading';
    });
    builder.addCase(fetchLatestRelease.fulfilled, (state, action) => {
      state.latestStatus = 'succeeded';
      state.latestRelease = action.payload;
    });
    builder.addCase(fetchLatestRelease.rejected, state => {
      state.latestStatus = 'failed';
    });
    builder.addCase(fetchReleaseById.pending, state => {
      state.isViewedModalOpen = true;
      state.viewedLoading = true;
      state.viewedNotFound = false;
      state.viewedRelease = null;
      // The drawer flow always shows the badge and never dismisses; reset in
      // case Help opened the viewer with different flags just before.
      state.viewedShowNewBadge = true;
      state.viewedDismissOnClose = false;
    });
    builder.addCase(fetchReleaseById.fulfilled, (state, action) => {
      state.viewedLoading = false;
      state.viewedRelease = action.payload;
      state.viewedNotFound = !action.payload;
    });
    builder.addCase(fetchReleaseById.rejected, state => {
      state.viewedLoading = false;
      state.viewedNotFound = true;
    });
  },
});

export const {
  openWhatsNewModal,
  closeWhatsNewModal,
  closeReleaseViewer,
  openLatestReleaseViewer,
} = whatsNewSlice.actions;
export default whatsNewSlice.reducer;
