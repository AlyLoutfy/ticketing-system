// Client-side storage layer using IndexedDB
// This provides a MongoDB-like API for the MVP

export interface Department {
  id: string;
  name: string;
  ticketTypes: TicketType[];
  subCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketType {
  id: string;
  name: string;
  defaultWD: number;
  description?: string;
  subCategory?: string;
  priority: string;
  workflowId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  department: string;
  ticketType: string;
  subCategory?: string;
  sla?: {
    value: number;
    unit: "hours" | "days";
  };
  clientName: string;
  unitId?: string;
  workingDays: number;
  priority: string;
  status: "Open" | "In Progress" | "Resolved" | "Rejected" | "Overdue" | "Closed";
  description?: string;
  ticketOwner: string;
  currentWorkflowStep?: number;
  workflowId?: string;
  currentDepartment?: string; // Which department is currently handling the ticket
  isFullyResolved?: boolean; // True only when final department marks as resolved
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
}

export interface WorkflowStep {
  id: string;
  departmentId: string;
  departmentName: string;
  stepNumber: number;
  isRequired: boolean;
  estimatedDays?: number;
  slaUnit?: "hours" | "days";
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowResolution {
  id: string;
  ticketId: string;
  stepNumber: number;
  fromDepartment: string;
  toDepartment?: string;
  resolvedBy: string;
  resolutionText: string;
  attachments?: FileAttachment[];
  resolvedAt: Date;
  isFinalResolution: boolean;
  isRevert?: boolean; // Mark revert actions
  // SLA tracking
  expectedSLA?: {
    value: number;
    unit: "hours" | "days" | "weeks";
  };
  actualTimeTaken?: {
    value: number;
    unit: "hours" | "days" | "weeks";
  };
  slaStatus?: "met" | "missed" | "exceeded";
  startedAt?: Date; // When the department started working on this step
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // Base64 encoded file data for MVP
  uploadedAt: Date;
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  changes: {
    field: string;
    oldValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined;
    newValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined;
  }[];
  changedBy?: string;
  changedAt: Date;
  reason?: string;
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private dbName = "TicketingSystem";
  private version = 6;
  private idCounter = 0;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private static instance: IndexedDBStorage;

  async init(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      // Check if we're in a browser environment
      if (typeof window === "undefined" || !window.indexedDB) {
        console.log("IndexedDB not available, using fallback");
        this.isInitialized = true;
        resolve();
        return;
      }

      console.log("Opening IndexedDB:", this.dbName, "version:", this.version);

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.error("IndexedDB initialization timeout, using fallback");
        this.isInitialized = true;
        resolve();
      }, 3000);

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        clearTimeout(timeout);
        console.error("IndexedDB error:", request.error);
        this.isInitialized = true;
        resolve(); // Don't reject, just continue without IndexedDB
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        console.log("IndexedDB opened successfully");
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log("IndexedDB upgrade needed");
        const db = (event.target as IDBOpenDBRequest).result;

        try {
          // Delete existing stores if they exist (for clean upgrade)
          if (db.objectStoreNames.contains("departments")) {
            db.deleteObjectStore("departments");
          }
          if (db.objectStoreNames.contains("tickets")) {
            db.deleteObjectStore("tickets");
          }
          if (db.objectStoreNames.contains("ticketHistory")) {
            db.deleteObjectStore("ticketHistory");
          }

          // Create departments store
          const deptStore = db.createObjectStore("departments", { keyPath: "id" });
          deptStore.createIndex("name", "name", { unique: true });

          // Create tickets store
          const ticketStore = db.createObjectStore("tickets", { keyPath: "id" });
          ticketStore.createIndex("department", "department");
          ticketStore.createIndex("status", "status");
          ticketStore.createIndex("priority", "priority");
          ticketStore.createIndex("createdAt", "createdAt");
          ticketStore.createIndex("dueDate", "dueDate");

          // Create ticket history store
          const historyStore = db.createObjectStore("ticketHistory", { keyPath: "id" });
          historyStore.createIndex("ticketId", "ticketId");
          historyStore.createIndex("changedAt", "changedAt");

          // Create workflows store
          const workflowStore = db.createObjectStore("workflows", { keyPath: "id" });
          workflowStore.createIndex("name", "name");
          workflowStore.createIndex("isDefault", "isDefault");

          // Create workflow resolutions store
          const resolutionStore = db.createObjectStore("workflowResolutions", { keyPath: "id" });
          resolutionStore.createIndex("ticketId", "ticketId");
          resolutionStore.createIndex("resolvedAt", "resolvedAt");

          console.log("Object stores created successfully");
        } catch (error) {
          console.error("Error during upgrade:", error);
          this.isInitialized = true;
          resolve(); // Don't reject, just continue without IndexedDB
        }
      };
    });

    return this.initPromise;
  }

  private ensureDB(): IDBDatabase | null {
    if (!this.isInitialized) {
      console.log("Database not initialized yet");
      return null;
    }
    if (!this.db) {
      console.log("IndexedDB not available, returning null");
      return null;
    }
    return this.db;
  }

  // Department operations
  async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      throw new Error("IndexedDB not available");
    }
    const now = new Date();
    const newDept: Department = {
      ...department,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.add(newDept);

      request.onsuccess = () => resolve(newDept);
      request.onerror = () => reject(request.error!);
    });
  }

  async getDepartments(): Promise<Department[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error!);
    });
  }

  async getDepartment(id: string): Promise<Department | null> {
    const db = this.ensureDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readonly");
      const store = transaction.objectStore("departments");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const existing = await this.getDepartment(id);
    if (!existing) {
      throw new Error("Department not found");
    }

    const updated: Department = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteDepartment(id: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Ticket Type operations
  async createTicketType(departmentId: string, ticketType: Omit<TicketType, "id" | "createdAt" | "updatedAt">): Promise<TicketType> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const now = new Date();
    const newTicketType: TicketType = {
      ...ticketType,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: [...department.ticketTypes, newTicketType],
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve(newTicketType);
      request.onerror = () => reject(request.error!);
    });
  }

  async updateTicketType(departmentId: string, ticketTypeId: string, updates: Partial<TicketType>): Promise<TicketType> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const ticketTypeIndex = department.ticketTypes.findIndex((t) => t.id === ticketTypeId);
    if (ticketTypeIndex === -1) {
      throw new Error("Ticket type not found");
    }

    const updatedTicketType: TicketType = {
      ...department.ticketTypes[ticketTypeIndex],
      ...updates,
      updatedAt: new Date(),
    };

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: [...department.ticketTypes.slice(0, ticketTypeIndex), updatedTicketType, ...department.ticketTypes.slice(ticketTypeIndex + 1)],
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve(updatedTicketType);
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteTicketType(departmentId: string, ticketTypeId: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const department = await this.getDepartment(departmentId);
    if (!department) {
      throw new Error("Department not found");
    }

    const updatedDepartment: Department = {
      ...department,
      ticketTypes: department.ticketTypes.filter((t) => t.id !== ticketTypeId),
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments"], "readwrite");
      const store = transaction.objectStore("departments");
      const request = store.put(updatedDepartment);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Ticket operations
  async createTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "dueDate">): Promise<Ticket> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const dueDate = this.calculateDueDate(now, ticket.workingDays);

    const newTicket: Ticket = {
      ...ticket,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
      dueDate,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.add(newTicket);

      request.onsuccess = () => resolve(newTicket);
      request.onerror = () => reject(request.error!);
    });
  }

  async getTickets(filters?: { department?: string; status?: string; priority?: string; search?: string }): Promise<Ticket[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const request = store.getAll();

      request.onsuccess = async () => {
        let tickets = request.result;

        // Update tickets to "Overdue" status if they're past due date
        const now = new Date();
        const ticketsToUpdate: Ticket[] = [];

        for (const ticket of tickets) {
          if (ticket.dueDate < now && ticket.status !== "Resolved" && ticket.status !== "Rejected" && ticket.status !== "Overdue" && ticket.status !== "Closed") {
            const updatedTicket = { ...ticket, status: "Overdue" as const, updatedAt: now };
            ticketsToUpdate.push(updatedTicket);
          }
        }

        // Update tickets that need status change
        if (ticketsToUpdate.length > 0) {
          for (const ticket of ticketsToUpdate) {
            await new Promise<void>((resolveUpdate, rejectUpdate) => {
              const updateRequest = store.put(ticket);
              updateRequest.onsuccess = () => resolveUpdate();
              updateRequest.onerror = () => rejectUpdate(updateRequest.error);
            });
          }

          // Update the tickets array with the new statuses
          tickets = tickets.map((ticket) => {
            const updated = ticketsToUpdate.find((ut) => ut.id === ticket.id);
            return updated || ticket;
          });
        }

        // Apply filters
        if (filters) {
          if (filters.department) {
            tickets = tickets.filter((t: Ticket) => t.department === filters.department);
          }
          if (filters.status) {
            tickets = tickets.filter((t: Ticket) => t.status === filters.status);
          }
          if (filters.priority) {
            tickets = tickets.filter((t: Ticket) => t.priority === filters.priority);
          }
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            tickets = tickets.filter((t: Ticket) => t.clientName.toLowerCase().includes(searchLower) || t.id.toLowerCase().includes(searchLower) || t.ticketType.toLowerCase().includes(searchLower));
          }
        }

        // Sort by creation date (newest first)
        tickets.sort((a: Ticket, b: Ticket) => b.createdAt.getTime() - a.createdAt.getTime());
        resolve(tickets);
      };
      request.onerror = () => reject(request.error!);
    });
  }

  async getTicket(id: string): Promise<Ticket | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readonly");
      const store = transaction.objectStore("tickets");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const existing = await this.getTicket(id);
    if (!existing) {
      console.error("Ticket not found:", id);
      throw new Error("Ticket not found");
    }

    // Track changes for history
    const changes: { field: string; oldValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined; newValue: string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined }[] = [];
    Object.keys(updates).forEach((key) => {
      const field = key as keyof Ticket;
      if (updates[field] !== undefined && existing[field] !== updates[field]) {
        changes.push({
          field,
          oldValue: existing[field] as string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined,
          newValue: updates[field] as string | number | Date | { value: number; unit: "hours" | "days" } | null | undefined,
        });
      }
    });

    const updated: Ticket = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    // Recalculate due date if working days changed
    if (updates.workingDays !== undefined) {
      updated.dueDate = this.calculateDueDate(updated.createdAt, updated.workingDays);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets", "ticketHistory"], "readwrite");
      const ticketStore = transaction.objectStore("tickets");
      const historyStore = transaction.objectStore("ticketHistory");

      // Update the ticket
      const ticketRequest = ticketStore.put(updated);

      ticketRequest.onsuccess = () => {
        // Add history entry if there are changes
        if (changes.length > 0) {
          const historyEntry: TicketHistory = {
            id: this.generateId(),
            ticketId: id,
            changes,
            changedAt: new Date(),
          };
          historyStore.add(historyEntry);
        }
        resolve(updated);
      };

      ticketRequest.onerror = () => {
        console.error("Database error:", ticketRequest.error);
        reject(ticketRequest.error);
      };
    });
  }

  async closeTicket(id: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const ticket = getRequest.result;
        if (!ticket) {
          reject(new Error("Ticket not found"));
          return;
        }

        const updatedTicket = {
          ...ticket,
          status: "Closed" as const,
          updatedAt: new Date(),
        };

        const putRequest = store.put(updatedTicket);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error!);
      };

      getRequest.onerror = () => reject(getRequest.error!);
    });
  }

  // Ticket history operations
  async getTicketHistory(ticketId: string): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["ticketHistory"], "readonly");
      const store = transaction.objectStore("ticketHistory");
      const index = store.index("ticketId");
      const request = index.getAll(ticketId);

      request.onsuccess = () => {
        const history = request.result;
        // Sort by date (newest first)
        history.sort((a: TicketHistory, b: TicketHistory) => b.changedAt.getTime() - a.changedAt.getTime());
        resolve(history);
      };
      request.onerror = () => reject(request.error!);
    });
  }

  async getAllTicketHistory(): Promise<TicketHistory[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["ticketHistory"], "readonly");
      const store = transaction.objectStore("ticketHistory");
      const request = store.getAll();

      request.onsuccess = () => {
        const history = request.result;
        // Sort by date (newest first)
        history.sort((a: TicketHistory, b: TicketHistory) => b.changedAt.getTime() - a.changedAt.getTime());
        resolve(history);
      };
      request.onerror = () => reject(request.error!);
    });
  }

  // Utility methods
  private generateId(): string {
    // Use a simple counter for server-side consistency
    this.idCounter += 1;
    return `id_${this.idCounter}`;
  }

  // Singleton pattern to ensure consistent state
  static getInstance(): IndexedDBStorage {
    if (!IndexedDBStorage.instance) {
      IndexedDBStorage.instance = new IndexedDBStorage();
    }
    return IndexedDBStorage.instance;
  }

  private calculateDueDate(startDate: Date, workingDays: number): Date {
    const dueDate = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < workingDays) {
      dueDate.setDate(dueDate.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
        daysAdded++;
      }
    }

    return dueDate;
  }

  // Seed data from JSON
  async seedDepartments(departmentsData: { name: string; ticketTypes: { name: string; defaultWD: number; description?: string; subCategory?: string; priority: string }[] }[]): Promise<void> {
    const existingDepartments = await this.getDepartments();
    if (existingDepartments.length > 0) {
      return;
    }

    for (const deptData of departmentsData) {
      const ticketTypes: TicketType[] = deptData.ticketTypes.map((type: { name: string; defaultWD: number; description?: string; subCategory?: string; priority: string }) => {
        return {
          id: this.generateId(),
          name: type.name,
          defaultWD: type.defaultWD,
          description: type.description || "",
          subCategory: type.subCategory || "",
          priority: type.priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      // Extract unique sub-categories from ticket types
      const subCategories = [...new Set(ticketTypes.map((type) => type.subCategory).filter(Boolean))] as string[];

      await this.createDepartment({
        name: deptData.name,
        ticketTypes,
        subCategories,
      });
    }
  }

  // Seed sample tickets for demonstration
  async seedSampleTickets(): Promise<void> {
    const existingTickets = await this.getTickets();
    if (existingTickets.length > 0) {
      return;
    }

    await this.seedAllSampleTickets();
  }

  // Force reseed all sample tickets (clears existing and creates new ones)
  async reseedSampleTickets(): Promise<void> {
    await this.clearAllTickets();
    await this.seedAllSampleTickets();
  }

  // Clear all tickets from database
  async clearAllTickets(): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["tickets"], "readwrite");
      const store = transaction.objectStore("tickets");
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error!);
    });
  }

  // Internal method to seed all sample tickets
  private async seedAllSampleTickets(): Promise<void> {
    const departments = await this.getDepartments();
    if (departments.length === 0) {
      return;
    }

    const sampleTickets = [
      {
        department: "Collection",
        ticketType: "Postpone Installement",
        clientName: "Ahmed Mohamed",
        ticketOwner: "Front Desk",
        workingDays: 8,
        priority: "High" as const,
        status: "Open" as const,
        description: "Client requested to postpone next installment due to financial difficulties",
      },
      {
        department: "Sports",
        ticketType: "Club",
        clientName: "Sarah Johnson",
        ticketOwner: "Front Desk",
        workingDays: 6,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Membership process for new club member",
      },
      {
        department: "Customer Care",
        ticketType: "General Info",
        clientName: "Mohamed Ali",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "General inquiry about payment schedule",
      },
      {
        department: "Contracts",
        ticketType: "Contract Signing",
        clientName: "Fatima Hassan",
        ticketOwner: "Front Desk",
        workingDays: 5,
        priority: "High" as const,
        status: "Open" as const,
        description: "Unit contract signing appointment needed",
      },
      {
        department: "TCR",
        ticketType: "WORK PERMIT",
        clientName: "Omar Khaled",
        ticketOwner: "Front Desk",
        workingDays: 1,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Urgent work permit for renovation",
      },
      {
        department: "Security",
        ticketType: "Access permission",
        clientName: "Layla Ahmed",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Request for visitor access permission",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Maintenance Works",
        clientName: "Hassan Ibrahim",
        ticketOwner: "Front Desk",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "AC maintenance request for unit 205",
      },
      {
        department: "HO (Handover)",
        ticketType: "Setting an appointment",
        clientName: "Nour El-Din",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Schedule handover appointment for new unit",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Security Issues",
        clientName: "Mariam Farouk",
        ticketOwner: "Front Desk",
        workingDays: 1,
        priority: "Critical" as const,
        status: "Open" as const,
        description: "Security breach reported in building A",
      },
      {
        department: "Resale & Rental",
        ticketType: "Existing client renting unit",
        clientName: "Karim Mostafa",
        ticketOwner: "Front Desk",
        workingDays: 5,
        priority: "Medium" as const,
        status: "Resolved" as const,
        description: "Rental agreement processing for existing client",
      },
      {
        department: "Collection",
        ticketType: "General Inquiry",
        clientName: "Dina Samir",
        ticketOwner: "Front Desk",
        workingDays: 2,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Inquiry about payment methods and schedules",
      },
      {
        department: "Sports",
        ticketType: "Gym",
        clientName: "Youssef Nabil",
        ticketOwner: "Front Desk",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Gym membership renewal and facility access",
      },
      // Additional test tickets for scrolling demonstration
      {
        department: "Collection",
        ticketType: "Payment Issue",
        clientName: "Amina Khalil",
        ticketOwner: "Collection Team",
        workingDays: 4,
        priority: "High" as const,
        status: "Open" as const,
        description: "Payment processing error needs resolution",
      },
      {
        department: "Customer Care",
        ticketType: "Complaint",
        clientName: "Tarek Mansour",
        ticketOwner: "Customer Care",
        workingDays: 2,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Service quality complaint from resident",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Repair Request",
        clientName: "Nadia Salem",
        ticketOwner: "Maintenance Team",
        workingDays: 5,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Elevator repair request for building B",
      },
      {
        department: "Security",
        ticketType: "Access Card",
        clientName: "Rami Fawzy",
        ticketOwner: "Security Team",
        workingDays: 1,
        priority: "High" as const,
        status: "Resolved" as const,
        description: "New access card issued for resident",
      },
      {
        department: "Contracts",
        ticketType: "Contract Amendment",
        clientName: "Sara Mahmoud",
        ticketOwner: "Legal Team",
        workingDays: 7,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Contract amendment for unit 301",
      },
      {
        department: "TCR",
        ticketType: "Renovation Permit",
        clientName: "Ahmed Zaki",
        ticketOwner: "TCR Team",
        workingDays: 3,
        priority: "High" as const,
        status: "Open" as const,
        description: "Renovation permit application for unit 402",
      },
      {
        department: "HO (Handover)",
        ticketType: "Unit Inspection",
        clientName: "Lina Ashraf",
        ticketOwner: "Handover Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Pre-handover inspection for unit 203",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Event Planning",
        clientName: "Mohamed Taha",
        ticketOwner: "Community Team",
        workingDays: 10,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Community event planning for residents",
      },
      {
        department: "Resale & Rental",
        ticketType: "Property Listing",
        clientName: "Dina Farid",
        ticketOwner: "Sales Team",
        workingDays: 5,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "New property listing for unit 105",
      },
      {
        department: "Collection",
        ticketType: "Payment Plan",
        clientName: "Omar Hassan",
        ticketOwner: "Collection Team",
        workingDays: 3,
        priority: "High" as const,
        status: "Closed" as const,
        description: "Payment plan arrangement completed",
      },
      {
        department: "Customer Care",
        ticketType: "General Inquiry",
        clientName: "Fatma Nour",
        ticketOwner: "Customer Care",
        workingDays: 1,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "General inquiry about amenities",
      },
      {
        department: "Sports",
        ticketType: "Pool Access",
        clientName: "Khaled Youssef",
        ticketOwner: "Sports Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Pool access request for family",
      },
      {
        department: "Security",
        ticketType: "Visitor Registration",
        clientName: "Mona Gamal",
        ticketOwner: "Security Team",
        workingDays: 1,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Visitor registration for weekend",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Cleaning Service",
        clientName: "Hassan Ali",
        ticketOwner: "Maintenance Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Deep cleaning service request",
      },
      {
        department: "Contracts",
        ticketType: "Lease Renewal",
        clientName: "Nour Ibrahim",
        ticketOwner: "Legal Team",
        workingDays: 5,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Lease renewal for commercial unit",
      },
      {
        department: "TCR",
        ticketType: "Construction Permit",
        clientName: "Tamer Mostafa",
        ticketOwner: "TCR Team",
        workingDays: 7,
        priority: "Critical" as const,
        status: "Open" as const,
        description: "Construction permit for building extension",
      },
      {
        department: "HO (Handover)",
        ticketType: "Key Collection",
        clientName: "Rania Samir",
        ticketOwner: "Handover Team",
        workingDays: 1,
        priority: "High" as const,
        status: "Resolved" as const,
        description: "Key collection for new unit owner",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Facility Booking",
        clientName: "Wael Kamal",
        ticketOwner: "Community Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Community hall booking for event",
      },
      {
        department: "Resale & Rental",
        ticketType: "Market Analysis",
        clientName: "Heba Magdy",
        ticketOwner: "Sales Team",
        workingDays: 4,
        priority: "Low" as const,
        status: "In Progress" as const,
        description: "Market analysis for property valuation",
      },
      // Additional tickets for better scrolling demonstration
      {
        department: "Collection",
        ticketType: "Payment Follow-up",
        clientName: "Yasmin Farouk",
        ticketOwner: "Collection Team",
        workingDays: 2,
        priority: "High" as const,
        status: "Open" as const,
        description: "Follow-up on overdue payment for unit 108",
      },
      {
        department: "Customer Care",
        ticketType: "Service Request",
        clientName: "Adel Mansour",
        ticketOwner: "Customer Care",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Service request for unit maintenance",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "HVAC Repair",
        clientName: "Noha El-Sayed",
        ticketOwner: "Maintenance Team",
        workingDays: 4,
        priority: "High" as const,
        status: "Open" as const,
        description: "HVAC system repair for building C",
      },
      {
        department: "Security",
        ticketType: "CCTV Issue",
        clientName: "Mahmoud Gaber",
        ticketOwner: "Security Team",
        workingDays: 1,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "CCTV camera malfunction in parking area",
      },
      {
        department: "Contracts",
        ticketType: "Contract Review",
        clientName: "Salma Ahmed",
        ticketOwner: "Legal Team",
        workingDays: 6,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Contract review for commercial lease",
      },
      {
        department: "TCR",
        ticketType: "Building Permit",
        clientName: "Karim Hassan",
        ticketOwner: "TCR Team",
        workingDays: 8,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Building permit for new construction",
      },
      {
        department: "HO (Handover)",
        ticketType: "Defect Report",
        clientName: "Rana Mohamed",
        ticketOwner: "Handover Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Defect report for unit 207",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Event Coordination",
        clientName: "Tarek El-Masry",
        ticketOwner: "Community Team",
        workingDays: 5,
        priority: "Low" as const,
        status: "In Progress" as const,
        description: "Community event coordination",
      },
      {
        department: "Resale & Rental",
        ticketType: "Property Valuation",
        clientName: "Dina El-Kady",
        ticketOwner: "Sales Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Property valuation for resale",
      },
      {
        department: "Collection",
        ticketType: "Payment Plan",
        clientName: "Ahmed El-Sherif",
        ticketOwner: "Collection Team",
        workingDays: 4,
        priority: "High" as const,
        status: "Closed" as const,
        description: "Payment plan arrangement completed",
      },
      {
        department: "Customer Care",
        ticketType: "Complaint Resolution",
        clientName: "Mona El-Hadidy",
        ticketOwner: "Customer Care",
        workingDays: 2,
        priority: "Critical" as const,
        status: "Resolved" as const,
        description: "Complaint resolution for service issue",
      },
      {
        department: "Sports",
        ticketType: "Equipment Maintenance",
        clientName: "Omar El-Naggar",
        ticketOwner: "Sports Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Gym equipment maintenance request",
      },
      {
        department: "Security",
        ticketType: "Access Control",
        clientName: "Layla El-Mahdy",
        ticketOwner: "Security Team",
        workingDays: 1,
        priority: "High" as const,
        status: "Open" as const,
        description: "Access control system update",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Plumbing Repair",
        clientName: "Hassan El-Sawy",
        ticketOwner: "Maintenance Team",
        workingDays: 2,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Plumbing repair for unit 305",
      },
      {
        department: "Contracts",
        ticketType: "Lease Agreement",
        clientName: "Nour El-Din",
        ticketOwner: "Legal Team",
        workingDays: 7,
        priority: "High" as const,
        status: "Open" as const,
        description: "New lease agreement preparation",
      },
      {
        department: "TCR",
        ticketType: "Safety Inspection",
        clientName: "Tamer El-Gamal",
        ticketOwner: "TCR Team",
        workingDays: 5,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Safety inspection for building D",
      },
      {
        department: "HO (Handover)",
        ticketType: "Final Inspection",
        clientName: "Rania El-Sherbiny",
        ticketOwner: "Handover Team",
        workingDays: 2,
        priority: "High" as const,
        status: "Resolved" as const,
        description: "Final inspection completed for unit 401",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Facility Maintenance",
        clientName: "Wael El-Masry",
        ticketOwner: "Community Team",
        workingDays: 4,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Community facility maintenance",
      },
      {
        department: "Resale & Rental",
        ticketType: "Market Research",
        clientName: "Heba El-Sayed",
        ticketOwner: "Sales Team",
        workingDays: 6,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Market research for pricing strategy",
      },
      {
        department: "Collection",
        ticketType: "Payment Reminder",
        clientName: "Youssef El-Khatib",
        ticketOwner: "Collection Team",
        workingDays: 1,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Payment reminder for unit 102",
      },
      {
        department: "Customer Care",
        ticketType: "Information Request",
        clientName: "Fatma El-Zahra",
        ticketOwner: "Customer Care",
        workingDays: 1,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "Information request about amenities",
      },
      {
        department: "Sports",
        ticketType: "Membership Renewal",
        clientName: "Khaled El-Sherif",
        ticketOwner: "Sports Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Sports membership renewal process",
      },
      {
        department: "Security",
        ticketType: "Patrol Schedule",
        clientName: "Mona El-Hadidy",
        ticketOwner: "Security Team",
        workingDays: 3,
        priority: "High" as const,
        status: "Open" as const,
        description: "Security patrol schedule update",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Electrical Repair",
        clientName: "Hassan El-Mahdy",
        ticketOwner: "Maintenance Team",
        workingDays: 4,
        priority: "Critical" as const,
        status: "In Progress" as const,
        description: "Electrical repair for unit 208",
      },
      {
        department: "Contracts",
        ticketType: "Contract Termination",
        clientName: "Nour El-Kady",
        ticketOwner: "Legal Team",
        workingDays: 5,
        priority: "High" as const,
        status: "Open" as const,
        description: "Contract termination process",
      },
      {
        department: "TCR",
        ticketType: "Environmental Assessment",
        clientName: "Tamer El-Sherif",
        ticketOwner: "TCR Team",
        workingDays: 7,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Environmental assessment for new project",
      },
      {
        department: "HO (Handover)",
        ticketType: "Documentation",
        clientName: "Rania El-Masry",
        ticketOwner: "Handover Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Resolved" as const,
        description: "Handover documentation completed",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Resident Survey",
        clientName: "Wael El-Gamal",
        ticketOwner: "Community Team",
        workingDays: 4,
        priority: "Low" as const,
        status: "Open" as const,
        description: "Resident satisfaction survey",
      },
      {
        department: "Resale & Rental",
        ticketType: "Property Marketing",
        clientName: "Heba El-Naggar",
        ticketOwner: "Sales Team",
        workingDays: 5,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Property marketing campaign",
      },
      {
        department: "Collection",
        ticketType: "Payment Verification",
        clientName: "Youssef El-Sawy",
        ticketOwner: "Collection Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Payment verification for unit 304",
      },
      {
        department: "Customer Care",
        ticketType: "Feedback Collection",
        clientName: "Fatma El-Mahdy",
        ticketOwner: "Customer Care",
        workingDays: 3,
        priority: "Low" as const,
        status: "In Progress" as const,
        description: "Customer feedback collection",
      },
      {
        department: "Sports",
        ticketType: "Facility Booking",
        clientName: "Khaled El-Khatib",
        ticketOwner: "Sports Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Sports facility booking request",
      },
      {
        department: "Security",
        ticketType: "Emergency Response",
        clientName: "Mona El-Zahra",
        ticketOwner: "Security Team",
        workingDays: 1,
        priority: "Critical" as const,
        status: "Resolved" as const,
        description: "Emergency response protocol activation",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Landscaping",
        clientName: "Hassan El-Sherif",
        ticketOwner: "Maintenance Team",
        workingDays: 6,
        priority: "Low" as const,
        status: "In Progress" as const,
        description: "Landscaping maintenance for common areas",
      },
      {
        department: "Contracts",
        ticketType: "Legal Consultation",
        clientName: "Nour El-Hadidy",
        ticketOwner: "Legal Team",
        workingDays: 4,
        priority: "High" as const,
        status: "Open" as const,
        description: "Legal consultation for contract dispute",
      },
      {
        department: "TCR",
        ticketType: "Compliance Check",
        clientName: "Tamer El-Masry",
        ticketOwner: "TCR Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Compliance check for building regulations",
      },
      {
        department: "HO (Handover)",
        ticketType: "Warranty Claim",
        clientName: "Rania El-Gamal",
        ticketOwner: "Handover Team",
        workingDays: 4,
        priority: "High" as const,
        status: "Open" as const,
        description: "Warranty claim for unit defects",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Community Rules",
        clientName: "Wael El-Naggar",
        ticketOwner: "Community Team",
        workingDays: 5,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Community rules update and communication",
      },
      {
        department: "Resale & Rental",
        ticketType: "Tenant Screening",
        clientName: "Heba El-Sawy",
        ticketOwner: "Sales Team",
        workingDays: 3,
        priority: "High" as const,
        status: "Open" as const,
        description: "Tenant screening for rental application",
      },
      {
        department: "Collection",
        ticketType: "Payment Reconciliation",
        clientName: "Youssef El-Mahdy",
        ticketOwner: "Collection Team",
        workingDays: 2,
        priority: "Medium" as const,
        status: "Closed" as const,
        description: "Payment reconciliation completed",
      },
      {
        department: "Customer Care",
        ticketType: "Service Improvement",
        clientName: "Fatma El-Khatib",
        ticketOwner: "Customer Care",
        workingDays: 4,
        priority: "Low" as const,
        status: "In Progress" as const,
        description: "Service improvement initiative",
      },
      {
        department: "Sports",
        ticketType: "Equipment Purchase",
        clientName: "Khaled El-Zahra",
        ticketOwner: "Sports Team",
        workingDays: 7,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "New sports equipment purchase request",
      },
      {
        department: "Security",
        ticketType: "Training Program",
        clientName: "Mona El-Sherif",
        ticketOwner: "Security Team",
        workingDays: 5,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Security staff training program",
      },
      {
        department: "FM (Facilities Management)",
        ticketType: "Waste Management",
        clientName: "Hassan El-Hadidy",
        ticketOwner: "Maintenance Team",
        workingDays: 3,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Waste management system improvement",
      },
      {
        department: "Contracts",
        ticketType: "Insurance Claim",
        clientName: "Nour El-Masry",
        ticketOwner: "Legal Team",
        workingDays: 6,
        priority: "High" as const,
        status: "In Progress" as const,
        description: "Insurance claim processing",
      },
      {
        department: "TCR",
        ticketType: "Quality Control",
        clientName: "Tamer El-Gamal",
        ticketOwner: "TCR Team",
        workingDays: 4,
        priority: "Medium" as const,
        status: "Open" as const,
        description: "Quality control inspection",
      },
      {
        department: "HO (Handover)",
        ticketType: "Customer Satisfaction",
        clientName: "Rania El-Naggar",
        ticketOwner: "Handover Team",
        workingDays: 2,
        priority: "Low" as const,
        status: "Resolved" as const,
        description: "Customer satisfaction survey completed",
      },
      {
        department: "CM (Community Management)",
        ticketType: "Event Management",
        clientName: "Wael El-Sawy",
        ticketOwner: "Community Team",
        workingDays: 6,
        priority: "Medium" as const,
        status: "In Progress" as const,
        description: "Community event management",
      },
      {
        department: "Resale & Rental",
        ticketType: "Market Analysis",
        clientName: "Heba El-Mahdy",
        ticketOwner: "Sales Team",
        workingDays: 8,
        priority: "High" as const,
        status: "Open" as const,
        description: "Comprehensive market analysis",
      },
    ];

    for (const ticketData of sampleTickets) {
      await this.createTicket(ticketData);
    }
  }

  // Clear all data (for testing)
  async clearAll(): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["departments", "tickets", "ticketHistory", "workflows", "workflowResolutions"], "readwrite");

      transaction.objectStore("departments").clear();
      transaction.objectStore("tickets").clear();
      transaction.objectStore("ticketHistory").clear();
      transaction.objectStore("workflows").clear();
      transaction.objectStore("workflowResolutions").clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Workflow Management
  async createWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt">): Promise<Workflow> {
    await this.init();
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const newWorkflow: Workflow = {
      ...workflow,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.add(newWorkflow);

      request.onsuccess = () => resolve(newWorkflow);
      request.onerror = () => reject(request.error!);
    });
  }

  async getWorkflows(): Promise<Workflow[]> {
    await this.init();
    const db = this.ensureDB();
    if (!db) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error!);
    });
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error!);
    });
  }

  async getDefaultWorkflow(): Promise<Workflow | null> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readonly");
      const store = transaction.objectStore("workflows");
      const request = store.getAll();

      request.onsuccess = () => {
        const workflows = request.result || [];
        const defaultWorkflow = workflows.find((w: Workflow) => w.isDefault);
        resolve(defaultWorkflow || null);
      };
      request.onerror = () => reject(request.error!);
    });
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const existing = await this.getWorkflow(id);
    if (!existing) {
      throw new Error("Workflow not found");
    }

    const updated: Workflow = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.put(updated);

      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error!);
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflows"], "readwrite");
      const store = transaction.objectStore("workflows");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error!);
    });
  }

  // Workflow Resolution Management
  async createWorkflowResolution(resolution: Omit<WorkflowResolution, "id" | "resolvedAt">): Promise<WorkflowResolution> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const newResolution: WorkflowResolution = {
      ...resolution,
      id: this.generateId(),
      resolvedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflowResolutions"], "readwrite");
      const store = transaction.objectStore("workflowResolutions");
      const request = store.add(newResolution);

      request.onsuccess = () => resolve(newResolution);
      request.onerror = () => reject(request.error!);
    });
  }

  // Resolve ticket for current department (workflow step)
  async resolveTicketForDepartment(ticketId: string, departmentName: string, resolutionText: string, attachments: FileAttachment[] = []): Promise<{ resolution: WorkflowResolution; updatedTicket: Ticket }> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");

    // Get the ticket
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // For now, we'll treat all resolutions as final until proper workflow is implemented
    // In a real system, this would check the workflow to determine next department
    const isFinalStep = true; // TODO: Implement proper workflow logic
    const nextDepartment = isFinalStep ? undefined : "Next Department"; // TODO: Get from workflow

    // Calculate SLA information
    const now = new Date();
    const ticketCreatedAt = ticket.createdAt;
    const timeSinceCreation = now.getTime() - ticketCreatedAt.getTime();
    const daysSinceCreation = timeSinceCreation / (1000 * 60 * 60 * 24);

    // Get expected SLA from ticket
    const expectedSLA = ticket.sla;
    const expectedDays = expectedSLA ? (expectedSLA.unit === "days" ? expectedSLA.value : expectedSLA.unit === "hours" ? expectedSLA.value / 24 : expectedSLA.value * 7) : 7; // Default to 7 days if no SLA

    // Calculate SLA status - for now, we'll use a simpler approach
    // In a real system, this would track actual work time per department
    let slaStatus: "met" | "missed" | "exceeded" = "met";

    // For the first step, compare against total SLA
    if (ticket.currentWorkflowStep === 1) {
      if (daysSinceCreation > expectedDays) {
        slaStatus = "missed";
      } else if (daysSinceCreation < expectedDays * 0.3) {
        slaStatus = "exceeded";
      }
    } else {
      // For subsequent steps, assume they met SLA unless we have better tracking
      slaStatus = "met";
    }

    // Create workflow resolution
    const resolution: Omit<WorkflowResolution, "id" | "resolvedAt"> = {
      ticketId,
      stepNumber: ticket.currentWorkflowStep || 1,
      fromDepartment: departmentName,
      toDepartment: nextDepartment,
      resolvedBy: "Current User", // TODO: Get actual user
      resolutionText,
      attachments,
      isFinalResolution: isFinalStep,
      expectedSLA: expectedSLA
        ? {
            value: expectedSLA.value,
            unit: expectedSLA.unit,
          }
        : undefined,
      actualTimeTaken: {
        value: Math.round(daysSinceCreation * 100) / 100,
        unit: "days",
      },
      slaStatus,
      startedAt: ticketCreatedAt, // For now, assume work started when ticket was created
    };

    const newResolution = await this.createWorkflowResolution(resolution);

    // Update ticket status
    const ticketUpdates: Partial<Ticket> = {
      currentDepartment: nextDepartment,
      currentWorkflowStep: isFinalStep ? undefined : (ticket.currentWorkflowStep || 1) + 1,
      isFullyResolved: isFinalStep,
      status: isFinalStep ? "Resolved" : "In Progress",
      updatedAt: new Date(),
    };

    const updatedTicket = await this.updateTicket(ticketId, ticketUpdates);

    return { resolution: newResolution, updatedTicket };
  }

  // Revert ticket to a previous department (admin action)
  async revertTicketToDepartment(ticketId: string, targetDepartment: string, reason: string, revertedBy: string = "Admin"): Promise<{ resolution: WorkflowResolution; updatedTicket: Ticket }> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");

    // Get the ticket
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Create revert resolution (special type of workflow resolution)
    const resolution: Omit<WorkflowResolution, "id" | "resolvedAt"> = {
      ticketId,
      stepNumber: (ticket.currentWorkflowStep || 1) - 1, // Decrement step
      fromDepartment: ticket.currentDepartment || "Unknown",
      toDepartment: targetDepartment,
      resolvedBy: revertedBy,
      resolutionText: `REVERT: ${reason}`,
      attachments: [],
      isFinalResolution: false,
      isRevert: true, // Mark as revert action
    };

    const newResolution = await this.createWorkflowResolution(resolution);

    // Update ticket to revert to previous department
    const ticketUpdates: Partial<Ticket> = {
      currentDepartment: targetDepartment,
      currentWorkflowStep: Math.max(1, (ticket.currentWorkflowStep || 1) - 1),
      isFullyResolved: false,
      status: "In Progress", // Reset to in progress
      updatedAt: new Date(),
    };

    const updatedTicket = await this.updateTicket(ticketId, ticketUpdates);

    return { resolution: newResolution, updatedTicket };
  }

  // Get workflow resolutions for a ticket
  async getWorkflowResolutions(ticketId: string): Promise<WorkflowResolution[]> {
    const db = this.ensureDB();
    if (!db) throw new Error("Database not available");

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["workflowResolutions"], "readonly");
      const store = transaction.objectStore("workflowResolutions");
      const index = store.index("ticketId");
      const request = index.getAll(ticketId);

      request.onsuccess = () => {
        const resolutions = request.result.map((resolution: WorkflowResolution & { resolvedAt: string }) => ({
          ...resolution,
          resolvedAt: new Date(resolution.resolvedAt),
          attachments: resolution.attachments || [],
        }));
        resolve(resolutions.sort((a, b) => a.stepNumber - b.stepNumber));
      };

      request.onerror = () => reject(request.error!);
    });
  }

  async resetDatabase(): Promise<void> {
    // Close existing connection
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // Delete the entire database
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      deleteRequest.onsuccess = () => {
        resolve();
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }
}

// Export singleton instance
export const storage = IndexedDBStorage.getInstance();
