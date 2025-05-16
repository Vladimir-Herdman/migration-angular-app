// src/app/tabs/tab_chatbot/tab_chatbot.page.ts
import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DatabaseService } from 'src/app/services/database.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IonContent, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';
import { marked } from 'marked';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-tab_chatbot',
  templateUrl: 'tab_chatbot.page.html',
  styleUrls: ['tab_chatbot.page.scss'],
  standalone: false, // Set to false (non-standalone) THIS LIL BUGGER WAS WHY IT WAS ALL COOKED
})
export class TabChatBotPage implements OnInit, OnDestroy {

  @ViewChild('messages_area', { static: false }) messages_area!: ElementRef<HTMLDivElement>;
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  message: string = "";
  isLoading: boolean = false;

  chatHistory: ChatMessage[] = [];
  private backendUrl: string = '';
  private queryParamsSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private databaseService: DatabaseService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {
    this.backendUrl = await this.databaseService.getPlatformBackendUrl();
    if (this.chatHistory.length === 0) {
        this.displayMessage("Hello! How can I help you with your relocation today?", 'bot');
        this.chatHistory.push({ role: 'assistant', content: "Hello! How can I help you with your relocation today?" });
    }

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      const prefillMessage = params['prefill'];
      if (prefillMessage) {
        this.message = `Tell me more about: "${prefillMessage}"`;
        // Maybe add a small delay or to make sure view is ready before sending message
        // to avoid potential race conditions if ngOnInit triggers this immediately.
        this.sendMessage();
        // Clear the query param after processing
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          queryParamsHandling: 'merge',
          replaceUrl: true // Avoid adding this state to browser history
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  async sendMessage() {
    if (!this.message.trim()) return;
    const userMessageText = this.message.trim();
    this.displayMessage(userMessageText, 'user');
    this.chatHistory.push({ role: 'user', content: userMessageText });
    this.message = "";
    this.isLoading = true;

    try {
      const botMessageText = await this.getChatResponse(userMessageText);
      this.displayMessage(botMessageText, 'bot');
      this.chatHistory.push({ role: 'assistant', content: botMessageText });
    } catch (error) {
      console.error('Error getting chat response:', error);
      this.displayMessage("Sorry, I couldn't get a response right now. Please try again.", 'bot');
      // Potentially push an error message to chatHistory as well for consistency?
      // this.chatHistory.push({ role: 'assistant', content: "Sorry, I couldn't get a response..." });
    } finally {
      this.isLoading = false;
    }
  }

  async getChatResponse(question: string): Promise<string> {
    try {
      const response = await this.http.post<{ response: string }>(`${this.backendUrl}/chat`, {
        message: question,
        history: this.chatHistory.slice(-10) // Send last 10 messages (role/content pairs)
      }).toPromise();
      return response?.response || "Received an empty response from the server.";
    } catch (error) {
      console.error('HTTP error getting chat response:', error);
      // Consider more specific error handling (e.g., check error status code)
      throw error; // Re-throw to be caught by sendMessage
    }
  }

  // Uses ViewChild 'messages_area'
  displayMessage(text: string, sender: 'user' | 'bot') {
    if (!this.messages_area?.nativeElement) {
        console.warn('Message area not ready, queuing message display');
        setTimeout(() => this.displayMessage(text, sender), 100);
        return;
    }

   let htmlContent: string;
    let messageContainerTag: string; // To hold 'p' or 'div'

    if (sender === 'bot') {
      try {
        htmlContent = marked.parse(text) as string;
      } catch (e) {
        console.error("Error parsing markdown:", e);
        htmlContent = this.escapeHTML(text);
      }
      messageContainerTag = 'div'; // Use <div> for bot's potentially complex HTML
    } else {
      htmlContent = this.escapeHTML(text);
      messageContainerTag = 'p';   // User's simple text can stay in a <p>
    }
    const senderClass = sender === 'user' ? 'user-side' : 'bot-side';
    // Use [innerHTML] binding on the <p> element in the template,
    // or construct the full HTML string here to be inserted.
    // Since we are manually inserting, constructing the full string is fine.
    const messageElementHtml = `<${messageContainerTag} class="message ${senderClass}">${htmlContent}</${messageContainerTag}>`;

    this.messages_area.nativeElement.insertAdjacentHTML('beforeend', messageElementHtml);
    this.scrollToBottom();

    const lastMessage = this.messages_area.nativeElement.lastElementChild as HTMLElement | null;
    if (lastMessage) {
      requestAnimationFrame(() => {
          lastMessage.classList.add("appear");
          // setTimeout(() => { lastMessage.classList.add("shake"); }, 50); // Shake can be distracting
          // setTimeout(() => { lastMessage.classList.remove("shake"); }, 550);
      });
    }
  }

  escapeHTML(text: string): string {
      const div = document.createElement("div");
      // Using textContent is safer for escaping than innerText for broader compatibility
      // and more accurately reflects how browsers handle text nodes.
      div.textContent = text;
      return div.innerHTML;
  }

  // Uses ViewChild 'content' (IonContent)
  scrollToBottom() {
    if (this.content) {
        // IonContent.scrollToBottom returns a promise
        this.content.scrollToBottom(300).catch(err => console.error("Scroll to bottom failed:", err));
    } else {
        console.warn("IonContent not available for scrolling.");
    }
  }

  // Method called by the template's (keydown.enter) event
  handleKeydown(event: KeyboardEvent) {
    // Check if Enter key was pressed without the Shift key
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent default behavior (like adding a newline)
      this.sendMessage();     // Send the message
    }
  }
}