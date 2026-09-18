import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Zapisuje akcję w logach systemowych
 * @param {Object} user Obiekt użytkownika (wymaga .name i .email)
 * @param {string} actionType Typ akcji (np. 'CREATE_USER', 'DELETE_REPORT')
 * @param {string} details Szczegółowy opis akcji
 */
export const logSystemAction = async (user, actionType, details) => {
  try {
    await addDoc(collection(db, 'system_logs'), {
      user: user.name || user.email || 'Nieznany System',
      userEmail: user.email || 'brak@email',
      action: actionType,
      details: details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Błąd podczas zapisywania logów:", error);
  }
};
