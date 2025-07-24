import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

class NotificationService {

  // Método privado para criar notificações em lote
  async #sendNotificationToUsers(userIds, notificationData) {
    if (!userIds || userIds.length === 0) return;
    const uniqueUserIds = [...new Set(userIds)];
    
    const batch = writeBatch(db);
    uniqueUserIds.forEach(userId => {
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        ...notificationData,
        userId: userId,
        lida: false,
        criadoEm: new Date(),
      });
    });
    
    await batch.commit();
    console.log(`🔔 Notificação do tipo "${notificationData.tipo}" enviada para ${uniqueUserIds.length} usuários.`);
  }

  // Busca usuários por área
  async #getUsersByArea(area) {
    const users = [];
    if (!area) return users;
    const q = query(collection(db, "usuarios"), where("area", "==", area));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  }

  // Notifica sobre nova mensagem
  async notifyNewMessage(ticketId, ticketData, messageData, senderId) {
    try {
      const recipients = new Set();
      // Notifica o criador do chamado
      if (ticketData.criadoPor && ticketData.criadoPor !== senderId) {
        recipients.add(ticketData.criadoPor);
      }
      // Notifica operadores da área atual do chamado
      if (ticketData.area) {
        const areaUsers = await this.#getUsersByArea(ticketData.area);
        areaUsers.forEach(user => {
          if (user.id !== senderId) recipients.add(user.id);
        });
      }
        
      await this.#sendNotificationToUsers(Array.from(recipients), {
        tipo: 'new_message',
        titulo: `Nova mensagem no chamado #${ticketId.slice(-6)}`,
        mensagem: `${messageData.remetenteNome}: ${messageData.conteudo.substring(0, 50)}...`,
        link: `/chamado/${ticketId}`,
        ticketId: ticketId,
      });
    } catch (error) {
      console.error('❌ Erro ao notificar nova mensagem:', error);
    }
  }
  
  // Notifica sobre mudança de status
  async notifyStatusChange(ticketId, ticketData, statusData, changerId) {
    try {
      const recipients = new Set();
      // Notifica o criador do chamado
      if (ticketData.criadoPor && ticketData.criadoPor !== changerId) {
        recipients.add(ticketData.criadoPor);
      }
      // Notifica operadores da área atual
      if (ticketData.area) {
        const areaUsers = await this.#getUsersByArea(ticketData.area);
        areaUsers.forEach(user => {
          if (user.id !== changerId) recipients.add(user.id);
        });
      }

      await this.#sendNotificationToUsers(Array.from(recipients), {
          tipo: 'status_changed',
          titulo: `Status: ${statusData.novoStatus}`,
          mensagem: `Chamado "${ticketData.titulo.substring(0, 20)}..." foi atualizado.`,
          link: `/chamado/${ticketId}`,
          ticketId: ticketId,
      });
    } catch (error)
    {
      console.error('❌ Erro ao notificar mudança de status:', error);
    }
  }
  
  // --- Funções para a UI (Dashboard, NotificationCenter) ---

  // Retorna todas as notificações de um usuário
  async getInAppNotifications(userId) {
    const notifications = [];
    const q = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("criadoEm", "desc"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      notifications.push({ id: doc.id, ...doc.data() });
    });
    return notifications;
  }

  // Retorna a contagem de notificações não lidas
  async getUnreadCount(userId) {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('lida', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  // Listener em tempo real para todas as notificações de um usuário
  subscribeToNotifications(userId, callback) {
    const q = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("criadoEm", "desc"));
    return onSnapshot(q, (querySnapshot) => {
      const notifications = [];
      querySnapshot.forEach((doc) => {
        notifications.push({ id: doc.id, ...doc.data() });
      });
      callback(notifications);
    });
  }

  // Marca uma notificação como lida
  async markAsRead(notificationId) {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { lida: true });
  }

  // Marca todas as notificações como lidas
  async markAllAsRead(userId) {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('lida', '==', false));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.update(doc.ref, { lida: true }));
    await batch.commit();
  }

  // Marca como lidas as notificações de um chamado específico
  async markTicketNotificationsAsRead(userId, ticketId) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('ticketId', '==', ticketId),
      where('lida', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.update(doc.ref, { lida: true, dataLeitura: new Date() }));
    await batch.commit();
  }

  // Retorna a contagem de notificações não lidas para um chamado específico
  async getUnreadNotificationsByTicket(userId, ticketId) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('ticketId', '==', ticketId),
      where('lida', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  }
}

const notificationService = new NotificationService();
export default notificationService;
