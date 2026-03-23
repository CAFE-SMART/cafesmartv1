import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '@/pages/Login';
import Inventario from '@/pages/Inventario';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function AppRoutes() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			
			{/* Rutas Protegidas */}
			<Route element={<ProtectedRoute />}>
				<Route path="/inventario" element={<Inventario />} />
			</Route>

			<Route path="/register" element={<Navigate to="/login" replace />} />
			<Route path="*" element={<Navigate to="/login" replace />} />
		</Routes>
	);
}

export default AppRoutes;
