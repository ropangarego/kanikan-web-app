import { Navigate, useParams } from 'react-router-dom'

export const PondDetailPage = () => {
  const { pondId = '' } = useParams()
  return <Navigate to={pondId ? `/ponds?pond=${pondId}` : '/ponds'} replace />
}
