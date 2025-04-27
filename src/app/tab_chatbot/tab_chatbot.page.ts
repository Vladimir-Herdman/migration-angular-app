import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-tab_chatbot',
  templateUrl: 'tab_chatbot.page.html',
  styleUrls: ['tab_chatbot.page.scss'],
  standalone: false,
})

export class TabChatBotPage implements OnInit {
  @ViewChild('messages_area', { static: false }) messages_area!: ElementRef;
  message: string = "";
  isLoading: boolean = false;

  chatHistory: ChatMessage[] = [];

  // Define the backend API URL
  private backendUrl = (Capacitor.getPlatform() === 'android') ?  'http://10.0.2.2:8000' : 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  ngOnInit() {
  this.displayMessage("Hello! How can I help you with your relocation today?", 'bot');
  }

  /**
   * This method here takes the text from the message box and makes it an
   * html <p> tag to display on screen.  It then sends that text to the
   * getMessage function to get a response from the AI model.
   */
  async sendMessage() {
    if (!this.message.trim()) return;

    const userMessageText = this.message.trim();
    this.displayMessage(userMessageText, 'user');

    // Add user message to history
    this.chatHistory.push({ role: 'user', content: userMessageText });

    this.message = ""; // Clear input field
    this.isLoading = true;

    try {
      // Get AI response and display on screen
      const botMessageText = await this.getChatResponse(userMessageText);
      this.displayMessage(botMessageText, 'bot'); // Display bot message

      // Add bot message to history
      this.chatHistory.push({ role: 'assistant', content: botMessageText });

    } catch (error) {
      console.error('Error getting chat response:', error);
      this.displayMessage("Sorry, I couldn't get a response right now. Please try again.", 'bot');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Sends the user message and history to the backend chat endpoint
   * and returns the bot's response text.
   */
  async getChatResponse(question: string): Promise<string> {
    try {
      // Send message and history to the backend
      const response = await this.http.post<{ response: string }>(`${this.backendUrl}/chat`, {
        message: question,
        history: this.chatHistory
      }).toPromise();

      if (response && response.response) {
        return response.response;
      } else {
        console.error("Backend returned empty response:", response);
        return "Received an empty response from the server.";
      }
    } catch (error) {
      console.error('HTTP error getting chat response:', error);
      // Rethrow the error to be caught by the sendMessage function
      throw error;
    }
  }

  /**
   * Displays a message in the chat area.
   */
  displayMessage(text: string, sender: 'user' | 'bot') {
    if (!this.messages_area || !this.messages_area.nativeElement) return;

    const escapedText = this.escapeHTML(text);
    const senderClass = sender === 'user' ? 'user-side' : 'bot-side';
    const html = `<p class="message ${senderClass}">${escapedText}</p>`;

    this.messages_area.nativeElement.insertAdjacentHTML('beforeend', html);
    this.scrollToBottom();

    // appear and shake animation to make it lively
    const lastMessage = this.messages_area.nativeElement.lastElementChild as HTMLElement | null;
    if (lastMessage) {
      setTimeout(() => {
        lastMessage.classList.add("appear", "shake");
      }, 10);

      setTimeout(() => {
        lastMessage.classList.remove("shake");
        void lastMessage.offsetWidth;
      }, 600);
    }
  }

    /**
     * This method is called when the user sends text (and on what the AI
     * returns) to clean extra html tags from it, essentially a protection
     * from any malicious code that could go in the message area
     */
  escapeHTML(text: string): string {
      const div = document.createElement("div");
      div.innerText = text;
      return div.innerHTML;
    }

  scrollToBottom() {
    const content = document.querySelector("ion-content");
    if (content && this.messages_area && this.messages_area.nativeElement) {
        content.getScrollElement().then(scrollElement => {
          setTimeout(() => { scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 200);
      });
    }
  }
}
