/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, redirect } from 'react-router-dom'
import { AppShell } from './ui/AppShell'

const TournamentsScreen = lazy(() => import('./ui/screens/TournamentsScreen').then((m) => ({ default: m.TournamentsScreen })))
const TournamentScreen = lazy(() => import('./ui/screens/TournamentScreen').then((m) => ({ default: m.TournamentScreen })))
const ProfileScreen = lazy(() => import('./ui/screens/ProfileScreen').then((m) => ({ default: m.ProfileScreen })))
const MerchScreen = lazy(() => import('./ui/screens/MerchScreen').then((m) => ({ default: m.MerchScreen })))
const AdminScreen = lazy(() => import('./ui/screens/admin/AdminScreen').then((m) => ({ default: m.AdminScreen })))
const AdminNewTournamentScreen = lazy(() => import('./ui/screens/admin/AdminNewTournamentScreen').then((m) => ({ default: m.AdminNewTournamentScreen })))
const AdminTournamentManageScreen = lazy(() => import('./ui/screens/admin/AdminTournamentManageScreen').then((m) => ({ default: m.AdminTournamentManageScreen })))
const AdminTournamentDisplayScreen = lazy(() => import('./ui/screens/admin/AdminTournamentDisplayScreen').then((m) => ({ default: m.AdminTournamentDisplayScreen })))

function screen(element: ReactNode) {
  return <Suspense fallback={<div className="text-sm">Загружаю…</div>}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    loader: () => redirect('/tournaments'),
  },
  {
    element: <AppShell />,
    children: [
      { path: '/tournaments', element: screen(<TournamentsScreen />) },
      { path: '/tournaments/:id', element: screen(<TournamentScreen />) },
      { path: '/profile', element: screen(<ProfileScreen />) },
      { path: '/merch', element: screen(<MerchScreen />) },
      { path: '/admin', element: screen(<AdminScreen />) },
      { path: '/admin/tournaments/new', element: screen(<AdminNewTournamentScreen />) },
      { path: '/admin/tournaments/:id', element: screen(<AdminTournamentManageScreen />) },
      { path: '/admin/tournaments/:id/display', element: screen(<AdminTournamentDisplayScreen />) },
    ],
  },
])
