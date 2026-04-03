import { useUser } from '../context/UserContext';

export function useAuth() {
  return useUser();
}
