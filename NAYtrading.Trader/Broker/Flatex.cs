using HtmlAgilityPack;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace NAYtrading.Trader
{
    public class Flatex : IBroker
    {
        public void Login(string user, string password, ChromeDriver chrome)
        {
            chrome.Navigate().GoToUrl("https://www.flatex.de/kunden-login/");

            var userElement = WaitForElementById(chrome, "uname_app", 30, x => true);
            var passwordElement = WaitForElementById(chrome, "password_app", 1, x => true);
            var sessionElement = WaitForElementById(chrome, "sessionpass", 1, x => true);
            var buttonElement = WaitForElementByXPath(chrome, "//*[@id='webfiliale_login']//div[@title='Anmelden']", 1, x => true);

            var closeModalElement = WaitForElementById(chrome, "closeModal", 1, x => true);
            if (closeModalElement != null && closeModalElement.Displayed)
                Click(chrome, closeModalElement);

            SendKeys(chrome, userElement, user);
            SendKeys(chrome, passwordElement, password);

            Thread.Sleep(1000);

            if (sessionElement.Selected)
                Click(chrome, sessionElement);

            Click(chrome, buttonElement);

            var element = WaitForElementById(chrome, "menu_overviewMenu", 50, x => true);
            if (element == null)
            {
                if (WaitForElementByXPath(chrome, "//*[contains(text(), 'Bitte prüfen Sie Kundennummer und Passwort')]", 1, x => true) != null)
                {
                    throw new FatalException("Incorrect username or password");
                }

                SaveScreenshot(chrome);
                throw new Exception("Did not load landing page");
            }
        }

        public decimal GetAvailableFunds(ChromeDriver chrome)
        {
            chrome.Navigate().GoToUrl("https://konto.flatex.de/banking-flatex");

            var title = WaitForElementById(chrome, "accountOverviewForm_TitleLine", 50, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });
            if (title == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not reach landing page");
            }

            var refreshXpath = "//a[@id='accountOverviewForm_refreshButton']";
            var refreshButton = WaitForElementByXPath(chrome, refreshXpath, 10, x => true);
            if (refreshButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find refresh button");
            }

            Click(chrome, refreshButton);

            Thread.Sleep(10000);

            var xpath = "//div[@id='accountOverviewForm_accountOverviewTableSmall']/div/div/div[div/text()='Cashkonto']/div[contains(@class,'SimpleBalance')]/span";
            var quantityElement = WaitForElementByXPath(chrome, xpath, 50, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });

            if (quantityElement == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find funds element");
            }

            var fundsText = quantityElement.GetAttribute("innerText");

            var regex = new Regex("^-?([\\d\\.]+)(,(\\d{0,3}))?(&nbsp;|\\s+)EUR$");
            var match = regex.Match(fundsText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                return amount;
            }
            else
            {
                SaveScreenshot(chrome);
                throw new Exception("Available funds cannot be parsed from " + fundsText);
            }
        }

        public int GetOwnedQuantity(string isin, string wkn, ChromeDriver chrome)
        {
            chrome.Navigate().GoToUrl("https://konto.flatex.de/banking-flatex");

            var title = WaitForElementById(chrome, "accountOverviewForm_TitleLine", 50, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });
            if (title == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not reach landing page");
            }

            var menu = WaitForElementById(chrome, "menu_overviewMenu", 1, x => true);
            if (menu == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find main menu element");
            }

            Click(chrome, menu);

            var submenu = WaitForElementByXPath(chrome, "//td[@id='menu_overviewMenu']/div/div[text()='Depotbestand']", 5, x => true);
            if (submenu == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find Depotbestand menu element");
            }

            Click(chrome, submenu);

            var toggleSearchButton = WaitForElementById(chrome, "depositStatementForm_tableSearchWidget_toggleSearchBarButton", 5, x => x.Displayed);
            if (toggleSearchButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find toggle search button");
            }

            if (toggleSearchButton.GetAttribute("title") == "Suche")
            {
                Click(chrome, toggleSearchButton);
            }

            var searchField = WaitForElementById(chrome, "depositStatementForm_tableSearchWidget_searchEditFieldWidget_editField", 5, x => x.Displayed);
            if (searchField == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find search field");
            }

            SendKeys(chrome, searchField, !string.IsNullOrEmpty(isin) ? isin : wkn);

            var startSearchButton = WaitForElementById(chrome, "depositStatementForm_tableSearchWidget_searchEditFieldWidget_searchButton", 5, x => x.Displayed);
            if (startSearchButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find start search button");
            }

            Click(chrome, startSearchButton);

            Thread.Sleep(1000);

            var dataTable = WaitForElementByXPath(chrome, "//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table[@class='Data']", 50, x => x.Displayed);
            if (dataTable == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find data table");
            }

            var refreshButton = WaitForElementById(chrome, "depositStatementForm_refreshButton", 1, x => x.Displayed);
            if (refreshButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find refresh button");
            }

            Click(chrome, refreshButton);

            Thread.Sleep(5000);

            dataTable = WaitForElementByXPath(chrome, "//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table[@class='Data']", 50, x => x.Displayed);
            if (dataTable == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find data table");
            }

            var sb = new StringBuilder();
            if (!string.IsNullOrEmpty(isin))
            {
                var tdIsin = string.Format("//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table/tbody/tr/td/table/tbody[contains(tr/td/a/text(),'{0}')]/../..", isin);
                sb.Append(tdIsin);
            }

            if (!string.IsNullOrEmpty(wkn))
            {
                if (sb.Length > 0)
                {
                    sb.Append(" | ");
                }

                var tdWkn = string.Format("//table[@id='depositStatementForm_depositStatementTable']/tbody/tr/td/table/tbody/tr/td/table/tbody/tr/td[contains(text(),'{0}')]/../../../..", wkn);
                sb.Append(tdWkn);
            }

            var xpath = string.Format("({0})/../preceding-sibling::tr[1]/td[2]/span", sb.ToString());
            var quantityElement = WaitForElementByXPath(chrome, xpath, 10, element =>
            {
                var x = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(x);
            });

            if (quantityElement == null)
            {
                return 0;
            }

            var text = quantityElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))? Stk.$");
            var match = regex.Match(text);
            if (match.Success)
            {
                var whole = match.Groups[1].Value.Replace(".", "");
                var fractions = match.Groups[3].Value;
                var amount = decimal.Parse(whole + "." + fractions, CultureInfo.InvariantCulture);
                return (int)amount;
            }
            else
            {
                SaveScreenshot(chrome);
                throw new Exception("Quantity cannot be parsed from " + text);
            }
        }

        public decimal GetPrice(string isin, TradingAction action, ChromeDriver chrome)
        {
            var searchField = WaitForElementById(chrome, "headerAreaForm_searchEditFieldWidget_editField", 1, x => true);
            if (searchField == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find search field");
            }

            SendKeys(chrome, searchField, isin);

            var searchButton = WaitForElementById(chrome, "headerAreaForm_searchEditFieldWidget_searchButton", 1, x => true);
            if (searchButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find search button");
            }

            for (var i = 0; i <= 4; ++i)
            {
                Click(chrome, searchButton);

                var nameElement = WaitForElementByXPath(chrome, "//div[@class='PaperInfoSubComponent']", 50, x => true);

                if (nameElement != null && nameElement.Displayed)
                {
                    break;
                }

                if (i == 4)
                {
                    SaveScreenshot(chrome);
                    throw new Exception("Could not find stock using the search feature");
                }
            }

            var anyPriceXpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/tbody/tr/td[count(//*[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/thead/tr[1]/td[div/a/text()='Brief']/preceding-sibling::*)+1]/span[text()!='']";
            var anyPriceElement = WaitForElementByXPath(chrome, anyPriceXpath, 50, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (anyPriceElement == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("No price element was found");
            }

            string priceTitle;
            switch (action)
            {
                case TradingAction.Buy:
                    priceTitle = "Brief";
                    break;
                case TradingAction.Sell:
                    priceTitle = "Geld";
                    break;
                default:
                    throw new Exception("Unknown trading action " + action);
            }

            var priceElement = GetPriceElement(chrome, priceTitle);

            var priceText = priceElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))?$");
            var match = regex.Match(priceText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                if (amount <= 0)
                {
                    SaveScreenshot(chrome);
                    throw new CancelOrderException(Status.TemporaryError, "Invalid price: " + amount);
                }

                return amount;
            }
            else
            {
                SaveScreenshot(chrome);
                throw new Exception("Price cannot be parsed from " + priceText);
            }
        }

        private IWebElement GetPriceElement(ChromeDriver chrome, string priceTitle)
        {
            IWebElement priceElement = null;

            var exchanges = ConfigurationManager.AppSettings["FlatexExchanges"] ?? "flatex Preis";
            foreach (var exchange in exchanges.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/tbody/tr[contains(td/div/text(),'" + exchange + "')]/td[count(//*[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/thead/tr[1]/td[div/a/text()='" + priceTitle + "']/preceding-sibling::*)+1]/span[text()!='']";

                priceElement = WaitForElementByXPath(chrome, xpath, 1, element =>
                {
                    var text = element.GetAttribute("innerText");
                    return !string.IsNullOrWhiteSpace(text) && text != "0,000" && text != "0.000";
                });

                if (priceElement != null)
                {
                    break;
                }
            }

            if (priceElement == null)
            {
                throw new CancelOrderException(Status.FatalError, "Could not find price element matching config key FlatexExchanges");
            }

            return priceElement;
        }

        public object GetTanChallenge(int quantity, TradingAction action, ChromeDriver chrome)
        {
            string title;
            switch (action)
            {
                case TradingAction.Buy:
                    title = "K";
                    break;
                case TradingAction.Sell:
                    title = "V";
                    break;
                default:
                    throw new Exception("Unknown trading action " + action);
            }

            var orderButton = GetOrderButton(chrome, title);

            Click(chrome, orderButton);

            var priceElement = WaitForElementById(chrome, "paperOrderSubmissionForm_quantity_amountEditField", 50, element => true);

            SendKeys(chrome, chrome.FindElementById("paperOrderSubmissionForm_quantity_amountEditField"), quantity.ToString());

            Click(chrome, chrome.FindElementById("paperOrderSubmissionForm_transactionFlowSubForm_nextButton"));

            var challengeXpath = "//*[@id='paperOrderSubmissionForm_transactionSecuritySubForm_tanLabel']/table/tbody/tr/td[contains(@class,'Challenge')]";
            var challengeElement = WaitForElementByXPath(chrome, challengeXpath, 50, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });
            if (challengeElement == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find TAN challenge element");
            }

            var challengeText = challengeElement.GetAttribute("innerText");

            var result = new TanChallenge();

            var regex = new Regex("^([A-M][1-9]) ([A-M][1-9]) ([A-M][1-9])$");
            var match = regex.Match(challengeText);
            if (match.Success)
            {
                result.TanChallenge1 = match.Groups[1].Value;
                result.TanChallenge2 = match.Groups[2].Value;
                result.TanChallenge3 = match.Groups[3].Value;
            }
            else
            {
                SaveScreenshot(chrome);
                throw new Exception("TAN challenge cannot be parsed from " + challengeText);
            }

            return result;
        }

        private IWebElement GetOrderButton(ChromeDriver chrome, string buttonTitle)
        {
            var anyExchange = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/tbody/tr/td/table/tbody/tr/td/input[@value='K']";
            var buyAny = WaitForElementByXPath(chrome, anyExchange, 50, x => true);
            if (buyAny == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find any order button");
            }

            IWebElement tradeButton = null;

            var exchanges = ConfigurationManager.AppSettings["FlatexExchanges"] ?? "flatex Preis";
            foreach (var exchange in exchanges.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var xpath = "//table[@id='paperSearchForm_paperInfoSubComponent_tradingPlaceTable']/tbody/tr/td/table/tbody/tr[td/div/text()='" + exchange + "']/td/table/tbody/tr/td/input[@value='" + buttonTitle + "']";

                tradeButton = WaitForElementByXPath(chrome, xpath, 1, x => true);
                if (tradeButton != null)
                {
                    break;
                }
            }

            if (tradeButton == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find order button matching config key FlatexExchanges");
            }

            return tradeButton;
        }

        public decimal GetQuote(string tan, ChromeDriver chrome)
        {
            var tanField = WaitForElementById(chrome, "paperOrderSubmissionForm_transactionSecuritySubForm_tan", 50, x => true);
            if (tanField == null)
            {
                SaveScreenshot(chrome);
                throw new Exception("Could not find tan field");
            }

            SendKeys(chrome, tanField, tan);

            Thread.Sleep(5000);

            var getQuoteButton = WaitForElementById(chrome, "paperOrderSubmissionForm_quoteButton", 5, x => true);

            Click(chrome, getQuoteButton);

            var priceXpath = "//div[@id='PaperOrder_Quote']/div/div[@class='Value']";
            var priceElement = WaitForElementByXPath(chrome, priceXpath, 50, element =>
            {
                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (priceElement == null)
            {
                var element = WaitForElementById(chrome, "paperOrderSubmissionForm_transactionSecuritySubForm_tan_validationErrorText", 1, x => true);
                if (element != null)
                {
                    var error = element.GetAttribute("innerText");
                    if (!string.IsNullOrEmpty(error))
                    {
                        if (error.Contains("Die Preisanfrage ist zur Zeit nicht möglich"))
                        {
                            throw new CancelOrderException(Status.TemporaryError, "Error message from broker: " + error);
                        }
                        else
                        {
                            SaveScreenshot(chrome);
                            throw new Exception("Error message from broker: " + error);
                        }
                    }
                }

                element = WaitForElementById(chrome, "serverErrors", 1, x => true);
                if (element != null)
                {
                    var error = element.GetAttribute("innerText");
                    if (!string.IsNullOrEmpty(error))
                    {
                        if (error.Contains("Die Preisanfrage ist zur Zeit nicht möglich"))
                        {
                            throw new CancelOrderException(Status.TemporaryError, "Error message from broker: " + error);
                        }
                        else if (error.Contains("Der Handelspartner lieferte kein Preisangebot"))
                        {
                            throw new CancelOrderException(Status.TemporaryError, "Error message from broker: " + error);
                        }
                        else
                        {
                            SaveScreenshot(chrome);
                            throw new Exception("Error message from broker: " + error);
                        }
                    }
                }

                throw new CancelOrderException(Status.TemporaryError, "Could not get offer or error message");
            }

            var priceText = priceElement.GetAttribute("innerText");

            var regex = new Regex("^([\\d\\.]+)(,(\\d{0,3}))?(&nbsp;|\\s+)EUR$");
            var match = regex.Match(priceText);
            if (match.Success)
            {
                var euros = match.Groups[1].Value.Replace(".", "");
                var cents = match.Groups[3].Value;
                var amount = decimal.Parse(euros + "." + cents, CultureInfo.InvariantCulture);
                return amount;
            }
            else
            {
                SaveScreenshot(chrome);
                throw new Exception("Offer cannot be parsed from " + priceText);
            }
        }

        public void PlaceOrder(ChromeDriver chrome)
        {
            var button = WaitForElementById(chrome, "paperOrderSubmissionForm_transactionFlowSubForm_nextButton", 20, x => true);
            if (button == null)
            {
                SaveScreenshot(chrome);
                throw new CancelOrderException(Status.TemporaryError, "Order button not found");
            }

            if (!button.Displayed)
            {
                SaveScreenshot(chrome);
                throw new CancelOrderException(Status.TemporaryError, "Order button not visible");
            }

            Click(chrome, button);

            var messageElement = WaitForElementByXPath(chrome, "//div[@id='TransactionDetailsComponent']/div/div[contains(@class,'Title')]", 120, element =>
            {
                if (!element.Displayed)
                {
                    return false;
                }

                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (messageElement != null)
            {
                var message = messageElement.GetAttribute("innerText");
                if (message.Contains("wurde ausgeführt") || message.Contains("wurde erfolgreich entgegen genommen"))
                {
                    return;
                }

                SaveScreenshot(chrome);
                throw new CancelOrderException(Status.FatalError, "Order was not confirmed as expected: " + message);
            }

            var errorElement = WaitForElementByXPath(chrome, "//*[@id='serverErrors']/div/table/tbody/tr/td[2]/ul/li", 1, element =>
            {
                if (!element.Displayed)
                {
                    return false;
                }

                var text = element.GetAttribute("innerText");
                return !string.IsNullOrWhiteSpace(text);
            });

            if (errorElement != null)
            {
                var text = errorElement.GetAttribute("innerText");
                if (text != null && text.Contains("Ihre Anfrage wurde von der Börse abgelehnt"))
                {
                    throw new CancelOrderException(Status.TemporaryError, "Error message from broker: " + text);
                }
                else if (text != null && text.Contains("Nicht genügend Cash-Bestand"))
                {
                    throw new CancelOrderException(Status.TemporaryError, "Error message from broker: " + text);
                }
                else 
                {
                    SaveScreenshot(chrome);
                    throw new CancelOrderException(Status.FatalError, "Error message from broker: " + text);
                }
            }
            else
            {
                SaveScreenshot(chrome);
                throw new CancelOrderException(Status.FatalError, "Could not get confirmation or error message");
            }
        }

        public void Logout(ChromeDriver chrome)
        {
            var logout = WaitForElementByXPath(chrome, "//div[@data-widgetname='sessionControlComponent.logoutLink']", 1, x => true);

            Click(chrome, logout);

            WaitForElementByXPath(chrome, "//li[contains(text(),'abgemeldet')]", 50, x => true);
        }

        private static IWebElement WaitForElementByXPath(ChromeDriver chrome, string xpath, int timeoutSeconds, Func<IWebElement, bool> validate)
        {
            for (int i = 0; i < timeoutSeconds * 10; i++)
            {
                Thread.Sleep(100);

                try
                {
                    var elements = chrome.FindElementsByXPath(xpath);
                    if (elements == null || elements.Count == 0)
                    {
                        continue;
                    }

                    if (validate(elements[0]))
                    {
                        return elements[0];
                    }
                }
                catch (Exception)
                {
                    continue;
                }
            }

            return null;
        }

        private static IWebElement WaitForElementById(ChromeDriver chrome, string id, int timeoutSeconds, Func<IWebElement, bool> validate)
        {
            for (int i = 0; i < timeoutSeconds * 10; i++)
            {
                Thread.Sleep(100);

                try
                {
                    var elements = chrome.FindElementsById(id);
                    if (elements == null || elements.Count == 0)
                    {
                        continue;
                    }

                    if (validate(elements[0]))
                    {
                        return elements[0];
                    }
                }
                catch (Exception)
                {
                    continue;
                }
            }

            return null;
        }

        private static void Click(ChromeDriver chrome, IWebElement element)
        {
            CheckPreviousAction(chrome);
            KillOverlay(chrome);
            chrome.ExecuteScript("$(arguments[0]).click();", element);
        }

        private static void SendKeys(ChromeDriver chrome, IWebElement element, string value)
        {
            CheckPreviousAction(chrome);
            KillOverlay(chrome);
            chrome.ExecuteScript("$(arguments[0]).val(arguments[1]);", element, value);
        }

        private static void CheckPreviousAction(ChromeDriver chrome)
        {
            var retry = chrome.FindElementsById("previousActionNotFinishedOverlayFormContainer");
            if (retry != null && retry.Count > 0)
            {
                throw new Exception("Previous action was not finished");
            }
        }

        private static void KillOverlay(ChromeDriver chrome)
        {
            var overlay = chrome.FindElementsByXPath("//div[contains(@class,'ui-widget-overlay')]");
            if (overlay != null && overlay.Count > 0)
            {
                chrome.ExecuteScript("arguments[0].setAttribute('display','none');", overlay[0]);
            }
        }

        private void SaveScreenshot(ChromeDriver chrome)
        {
            chrome.GetScreenshot().SaveAsFile(DateTime.Now.ToString("yyyyMMdd-HH-mm-ss") + ".png");
        }

        public class TanChallenge
        {
            public string TanChallenge1;
            public string TanChallenge2;
            public string TanChallenge3;

            public override string ToString()
            {
                return string.Format("{0} {1} {2}", TanChallenge1, TanChallenge2, TanChallenge3);
            }
        }
    }
}
