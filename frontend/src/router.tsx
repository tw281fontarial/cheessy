import { createBrowserRouter, redirect } from 'react-router-dom'
import { AppShell } from './ui/AppShell'
import { TournamentsScreen } from './ui/screens/TournamentsScreen'
import { TournamentScreen } from './ui/screens/TournamentScreen'
import { ProfileScreen } from './ui/screens/ProfileScreen'
import { MerchScreen } from './ui/screens/MerchScreen'
import { AdminScreen } from './ui/screens/admin/AdminScreen'
import { AdminNewTournamentScreen } from './ui/screens/admin/AdminNewTournamentScreen'
import { AdminTournamentManageScreen } from './ui/screens/admin/AdminTournamentManageScreen'
import { AdminTournamentDisplayScreen } from './ui/screens/admin/AdminTournamentDisplayScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    loader: () => redirect('/tournaments'),
  },
  {
    element: <AppShell />,
    children: [
      { path: '/tournaments', element: <TournamentsScreen /> },
      { path: '/tournaments/:id', element: <TournamentScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
      { path: '/merch', element: <MerchScreen /> },
      { path: '/admin', element: <AdminScreen /> },
      { path: '/admin/tournaments/new', element: <AdminNewTournamentScreen /> },
      { path: '/admin/tournaments/:id', element: <AdminTournamentManageScreen /> },
      { path: '/admin/tournaments/:id/display', element: <AdminTournamentDisplayScreen /> },
    ],
  },
])

