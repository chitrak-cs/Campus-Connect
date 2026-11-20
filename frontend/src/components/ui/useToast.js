import toast from 'react-hot-toast'

// Consistent toast API. Theming (light/dark) lives in the <Toaster> options in main.jsx + toast.css.
const useToast = () => ({
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  info: (msg) => toast(msg),
  promise: toast.promise,
  dismiss: toast.dismiss,
})
export default useToast
