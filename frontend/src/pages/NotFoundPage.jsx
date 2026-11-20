import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useEffect } from 'react'
import { EmptyState, Button } from '../components/ui'

export default function NotFoundPage() {
  useEffect(() => { document.title = 'Page not found · Campus Connect' }, [])
  return (
    <main className="splash">
      <EmptyState icon={Compass} title="Page not found" text="The page you're looking for doesn't exist or has moved."
        action={<Link to="/"><Button>Back to home</Button></Link>} />
    </main>
  )
}
